from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from typing import Any, Dict, List, Optional, Tuple
import os
from bson import ObjectId
import logging

def _get_mongo_uri() -> str:
    return os.getenv("MONGODB_URI", "mongodb://localhost:27017/")

def _get_mongo_db_name() -> str:
    return os.getenv("MONGODB_DB", "csr_data")

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


def get_opportunity_by_url(url: str) -> Optional[OpportunityDoc]:
    col = get_opportunities_collection()
    return col.find_one({"url": url})


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


def create_indexes() -> None:
    col = get_opportunities_collection()
    try:
        col.create_index("url", unique=True)
        logging.info("Created unique index on 'url' field.")
    except Exception as e:
        if "E11000" in str(e) or "duplicate key" in str(e).lower():
            logging.warning(f"Duplicate URLs exist in database. Cleaning up duplicates...")
            pipeline = [
                {"$group": {"_id": "$url", "ids": {"$push": "$_id"}, "count": {"$sum": 1}}},
                {"$match": {"count": {"$gt": 1}}}
            ]
            duplicates = list(col.aggregate(pipeline))
            for dup in duplicates:
                ids_to_keep = dup["ids"][:1]
                ids_to_remove = dup["ids"][1:]
                if ids_to_remove:
                    col.delete_many({"_id": {"$in": ids_to_remove}})
                    logging.info(f"Removed {len(ids_to_remove)} duplicate(s) for URL: {dup['_id']}")
            col.create_index("url", unique=True)
            logging.info("Created unique index on 'url' field after cleanup.")
        else:
            logging.error(f"Failed to create index: {e}")
            raise


def get_site_configs_collection() -> Collection:
    return get_db()["site_configs"]


SiteConfigDoc = Dict[str, Any]


def list_site_configs() -> List[SiteConfigDoc]:
    col = get_site_configs_collection()
    return list(col.find().sort("domain", 1))


def get_site_config_by_domain(domain: str) -> Optional[SiteConfigDoc]:
    col = get_site_configs_collection()
    return col.find_one({"domain": domain})


def insert_site_config(data: SiteConfigDoc) -> Optional[SiteConfigDoc]:
    col = get_site_configs_collection()
    col.create_index("domain", unique=True)
    res = col.insert_one(data)
    return col.find_one({"_id": res.inserted_id})


def update_site_config(domain: str, data: SiteConfigDoc) -> Optional[SiteConfigDoc]:
    col = get_site_configs_collection()
    col.find_one_and_update({"domain": domain}, {"$set": data}, upsert=True)
    return col.find_one({"domain": domain})


def delete_site_config(domain: str) -> bool:
    col = get_site_configs_collection()
    res = col.delete_one({"domain": domain})
    return res.deleted_count == 1


# ========== Users Collection ==========

def get_users_collection() -> Collection:
    return get_db()["users"]


UserDoc = Dict[str, Any]


def list_users(
    page: int = 1,
    page_size: int = 10,
    q: Optional[str] = None,
    role: Optional[str] = None,
) -> Tuple[List[UserDoc], int]:
    col = get_users_collection()
    filter: Dict[str, Any] = {}

    def escape_regex(s: str) -> str:
        return "".join([f"\\{c}" if c in ".*+?^${}()|[]\\" else c for c in s])

    if q:
        regex = {"$regex": escape_regex(q), "$options": "i"}
        filter["$or"] = [
            {"name": regex},
            {"email": regex},
        ]

    if role:
        filter["role"] = role

    total = col.count_documents(filter)
    cursor = col.find(filter).sort("createdAt", -1).skip((page - 1) * page_size).limit(page_size)
    items = list(cursor)
    return items, total


def get_user_by_id(user_id: str) -> Optional[UserDoc]:
    col = get_users_collection()
    try:
        _id = ObjectId(user_id)
    except Exception:
        return None
    return col.find_one({"_id": _id})


def get_user_by_email(email: str) -> Optional[UserDoc]:
    col = get_users_collection()
    return col.find_one({"email": email})


def insert_user(data: UserDoc) -> Optional[UserDoc]:
    col = get_users_collection()
    col.create_index("email", unique=True)
    res = col.insert_one(data)
    return col.find_one({"_id": res.inserted_id})


def update_user(user_id: str, data: UserDoc) -> Optional[UserDoc]:
    col = get_users_collection()
    try:
        _id = ObjectId(user_id)
    except Exception:
        return None
    col.find_one_and_update({"_id": _id}, {"$set": data})
    return col.find_one({"_id": _id})


def delete_user(user_id: str) -> bool:
    col = get_users_collection()
    try:
        _id = ObjectId(user_id)
    except Exception:
        return False
    res = col.delete_one({"_id": _id})
    return res.deleted_count == 1
