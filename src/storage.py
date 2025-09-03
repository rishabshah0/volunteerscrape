from pymongo import MongoClient

def save_to_mongodb(data: dict, db_name="volunteer_data", collection_name="opportunities") -> None:
    client = MongoClient('mongodb://localhost:27017/')
    db = client[db_name]
    collection = db[collection_name]

    url = data.get("url")
    if collection.find_one({"url": url}):
        print(f"URL {url} already exists in {db_name}.{collection_name}. Skipping.")
        return

    collection.insert_one(data)
    print(f"Successfully saved opportunity from {url} to {db_name}.{collection_name}.")
