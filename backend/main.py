from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from backend.database import engine, SessionLocal
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from backend import models, schemas
import os
import requests

# ============================
# DATABASE INIT
# ============================

models.Base.metadata.create_all(bind=engine)

# ============================
# SECURITY
# ============================

SECRET_KEY = "super_secret_key_change_this"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_password_hash(password):
    return pwd_context.hash(password[:72])

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password[:72], hashed_password)

def create_access_token(data: dict):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    data.update({"exp": expire})
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

# ============================
# APP
# ============================

app = FastAPI(title="Protected Image Search")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================
# DB DEPENDENCY
# ============================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================
# AUTH VALIDATION
# ============================

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):

    credentials_exception = HTTPException(
        status_code=401,
        detail="Invalid authentication",
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.username == username).first()

    if user is None:
        raise credentials_exception

    return user

# ============================
# ROUTES
# ============================

@app.get("/")
def home():
    return {"message": "Protected Image Search API Running"}

# REGISTER
@app.post("/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):

    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=get_password_hash(user.password)
    )

    db.add(new_user)
    db.commit()

    return {"message": "User registered successfully"}

# LOGIN
@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):

    user = db.query(models.User).filter(models.User.username == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    access_token = create_access_token(data={"sub": user.username})

    return {"access_token": access_token, "token_type": "bearer"}

# ============================
# PROTECTED SEARCH
# ============================

@app.get("/search")
def search_images(query: str, current_user: models.User = Depends(get_current_user)):

    api_key = os.getenv("SERPAPI_KEY")

    if not api_key:
        return {"error": "SerpAPI key not found"}

    response = requests.get(
        "https://serpapi.com/search.json",
        params={
            "engine": "google_images",
            "q": query,
            "api_key": api_key
        }
    )

    data = response.json()

    images = []

    if "images_results" in data:
        for item in data["images_results"][:12]:
            images.append({
                "title": item.get("title"),
                "thumbnail": item.get("thumbnail"),
                "source": item.get("source")
            })

    return {
        "searched_by": current_user.username,
        "query": query,
        "results": images
    }
