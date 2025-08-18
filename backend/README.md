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
JWT_SECRET=supersecretbuildathonkey
JWT_ALGORITHM=HS256
SESSION_SECRET_KEY=your_super_secret_key_here
ENV=dev # Bypass client bearer token auth
```

## New url registration
Everytime we get a new url register in console - https://console.cloud.google.com/apis/credentials?inv=1&invt=Ab5KIw&project=personal-468520 
# Mongo removed
Join Discord server for notifications - https://discord.gg/jsyHVhSp