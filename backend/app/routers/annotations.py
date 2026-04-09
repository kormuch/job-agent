import json
import os
from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/annotations", tags=["annotations"])

ANNOTATIONS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "annotations.json")

class AnnotationIn(BaseModel):
    selector: str
    tagName: str
    text: str
    comment: str
    timestamp: str

@router.post("/")
def save_annotation(annotation: AnnotationIn):
    data = []
    if os.path.exists(ANNOTATIONS_FILE):
        with open(ANNOTATIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    data.append(annotation.model_dump())
    with open(ANNOTATIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return {"status": "saved", "total": len(data)}

@router.get("/")
def get_annotations():
    if not os.path.exists(ANNOTATIONS_FILE):
        return []
    with open(ANNOTATIONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@router.delete("/{index}")
def delete_annotation(index: int):
    if not os.path.exists(ANNOTATIONS_FILE):
        return {"status": "not_found"}
    with open(ANNOTATIONS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    if index < 0 or index >= len(data):
        return {"status": "out_of_range"}
    data.pop(index)
    with open(ANNOTATIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return {"status": "deleted", "total": len(data)}
