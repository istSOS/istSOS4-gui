"""Read-only SaQC previews. This service has no istSOS credentials or writes."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Literal

from engine import preview

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/hello")
async def hello():
    return {"message": "Hello world from the SaQC service!"}


class PreviewRequest(BaseModel):
    rows: list[dict] = Field(max_length=60000)
    constraints: list[dict] = Field(max_length=4)
    slots: list[int] = Field(max_length=4)
    samplingFrequency: str | None = None
    editedKeys: list[str] = Field(default_factory=list, max_length=20000)
    targetKeys: list[str] | None = Field(default=None, max_length=20000)
    includeAffected: bool = True
    qualityMode: Literal['existing', 'converted'] = 'existing'
    repairUnknownQuality: bool = False


@app.post("/preview")
def quality_preview(request: PreviewRequest):
    try:
        return preview(request.rows, request.constraints, request.slots,
                       request.samplingFrequency, request.editedKeys, request.targetKeys, request.qualityMode,
                       request.includeAffected, request.repairUnknownQuality)
    except (ValueError, KeyError, TypeError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
