from fastapi import FastAPI

app = FastAPI(title="Smart Shrimp Farm AI Service")

@app.get("/")
def read_root():
    return {"message": "Welcome to the SSFM AI/RAG Service API!"}
