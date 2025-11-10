from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from typing import Any, Dict, List, Optional, Tuple
import os
from bson import ObjectId

def _get_mongo_uri() -> str:
    return os.getenv("MONGODB_URI", "mongodb://localhost:27017/")

def _get_mongo_db_name() -> str:
    return os.getenv("MONGODB_DB", "volunteer_data")

_client: Optional[MongoClient] = None

def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(_get_mongo_uri())
    return _client


def get_db() -> Database:
    return get_client()[_get_mongo_db_name()]


def get_opportunities_collection() -> Collection:
    return get_db()["opportunities"]


def save_to_mongodb(data: dict, db_name="volunteer_data", collection_name="opportunities") -> None:  # noqa: D401
    client = MongoClient('mongodb://localhost:27017/')
    db = client[db_name]
    collection = db[collection_name]

    url = data.get("url")
    if collection.find_one({"url": url}):
        print(f"URL {url} already exists in {db_name}.{collection_name}. Skipping.")
        return

    collection.insert_one(data)
    print(f"Successfully saved opportunity from {url} to {db_name}.{collection_name}.")


OpportunityDoc = Dict[str, Any]


def list_opportunities(
    page: int = 1,
    page_size: int = 10,
    q: Optional[str] = None,
    tag: Optional[str] = None,
    location: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Tuple[List[OpportunityDoc], int]:
    col = get_opportunities_collection()
    filter: Dict[str, Any] = {}
    and_clauses: List[Dict[str, Any]] = []

    def escape_regex(s: str) -> str:
        return "".join([f"\\{c}" if c in ".*+?^${}()|[]\\" else c for c in s])

    if q:
        regex = {"$regex": escape_regex(q), "$options": "i"}
        and_clauses.append({"$or": [
            {"title": regex},
            {"organization": regex},
            {"organization_name": regex},
            {"location": regex},
            {"tags": {"$in": [regex]}},
            {"description": regex},
            {"extra": regex},
        ]})
    if tag:
        and_clauses.append({"tags": {"$in": [tag]}})
    if location:
        regex = {"$regex": escape_regex(location), "$options": "i"}
        and_clauses.append({"location": regex})
    if date_from or date_to:
        range_cond: Dict[str, Any] = {}
        if date_from:
            range_cond["$gte"] = date_from
        if date_to:
            range_cond["$lte"] = date_to
        and_clauses.append({"$or": [{"dateStart": range_cond}, {"date_start": range_cond}]})

    if and_clauses:
        filter["$and"] = and_clauses

    total = col.count_documents(filter)
    cursor = col.find(filter).sort("_id", -1).skip((page - 1) * page_size).limit(page_size)
    items = list(cursor)
    return items, total


def get_opportunity_by_id(opportunity_id: str) -> Optional[OpportunityDoc]:
    col = get_opportunities_collection()
    try:
        _id = ObjectId(opportunity_id)
    except Exception:
        return None
    return col.find_one({"_id": _id})


def insert_opportunity(data: OpportunityDoc) -> Optional[OpportunityDoc]:
    col = get_opportunities_collection()
    res = col.insert_one(data)
    return col.find_one({"_id": res.inserted_id})


def update_opportunity(opportunity_id: str, data: OpportunityDoc) -> Optional[OpportunityDoc]:
    col = get_opportunities_collection()
    try:
        _id = ObjectId(opportunity_id)
    except Exception:
        return None
    col.find_one_and_update({"_id": _id}, {"$set": data})
    return col.find_one({"_id": _id})


def delete_opportunity(opportunity_id: str) -> bool:
    col = get_opportunities_collection()
    try:
        _id = ObjectId(opportunity_id)
    except Exception:
        return False
    res = col.delete_one({"_id": _id})
    return res.deleted_count == 1
