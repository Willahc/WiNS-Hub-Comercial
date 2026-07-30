import json
import subprocess

containers = [
  "wins_agro_v1-hub-api-1",
  "wins_agro_v1-api-1",
  "wins_hub_wave1_keycloak",
  "wins_hub_engenharia_api",
  "wins_agro_v1-saude-api",
  "wins_hub_log_api",
  "wins_agro_v1-db-1"
]

def inspect_containers():
    out = []
    for c in containers:
        proc = subprocess.run(["docker", "inspect", c], capture_output=True, text=True)
        if proc.returncode != 0:
            out.append({"container": c, "error": "not found"})
            continue
        data = json.loads(proc.stdout)[0]
        
        env_names = [e.split("=")[0] for e in data["Config"]["Env"]]
        mounts = [{"type": m.get("Type"), "source": m.get("Source"), "destination": m.get("Destination")} for m in data.get("Mounts", [])]
        
        out.append({
            "name": data["Name"].lstrip("/"),
            "image": data["Config"]["Image"],
            "image_id": data["Image"],
            "created": data["Created"],
            "status": data["State"]["Status"],
            "running": data["State"]["Running"],
            "restart_count": data["RestartCount"],
            "restart_policy": data["HostConfig"]["RestartPolicy"]["Name"],
            "health": data["State"].get("Health", {}).get("Status", "N/A"),
            "mounts": mounts,
            "env_names": env_names
        })
    print(json.dumps(out, indent=2))

if __name__ == "__main__":
    inspect_containers()
