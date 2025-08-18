## Links
- Backend swagger: http://localhost:8000/docs  

## Commands
- Create virtual env and activate: 
    ```
    python3 -m venv .venv
    source .venv/bin/activate  
    pip install -r requirements.txt
    .venv/bin/python3 -m pip install --upgrade pip
    ```
- Bring up application: `docker compose up --build`
- Run - `uvicorn main:app --reload --host 0.0.0.0 --port 8000`

## .env

```
GOOGLE_CLIENT_ID="<GOOGLE_CLIENT_ID>"
GOOGLE_CLIENT_SECRET="<GOOGLE_CLIENT_SECRET>"
JWT_SECRET=supersecretbuildathonkey
JWT_ALGORITHM=HS256
SESSION_SECRET_KEY=your_super_secret_key_here
ENV=dev # Bypass client bearer token auth


MONGO_INITDB_ROOT_USERNAME=root
MONGO_INITDB_ROOT_PASSWORD=changeme
MONGO_URI=mongodb://root:changeme@mongo_container:27017
```

## New url registration
Everytime we get a new url register in console - https://console.cloud.google.com/apis/credentials?inv=1&invt=Ab5KIw&project=personal-468520 
Mongo - https://cloud.mongodb.com/v2/6898e6a1ce5e9959ff30655d#/overview
Join Discord server for notifications - https://discord.gg/jsyHVhSp