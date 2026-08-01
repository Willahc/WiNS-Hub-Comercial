import time
import subprocess
import urllib.request
import json

def test_api_endpoints():
    print("Iniciando testes da API unificada (FastAPI)...")
    
    # 1. Start FastAPI app in background on port 8000
    server_process = subprocess.Popen(
        ["uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd="/root/wins_hub_unificado/apps/api"
    )
    
    # Wait for the server to spin up
    time.sleep(4)
    
    # Test cases
    success = True
    
    def request_api(path, headers=None):
        url = f"http://127.0.0.1:8000{path}"
        req = urllib.request.Request(url, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                return response.status, json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode('utf-8'))
        except Exception as e:
            return 500, str(e)

    # 1. Health Endpoint
    status, body = request_api("/api/v1/health")
    print(f"Health status: {status} | body: {body}")
    if status != 200 or body.get("status") != "ok":
        print("FAIL: Healthcheck falhou.")
        success = False

    headers = {"Authorization": "Bearer mock_jwt_token_rodrigo_almeida"}

    # 2. Auth checking (without authorization headers)
    status_no_auth, body_no_auth = request_api("/api/v1/eventos")
    print(f"Unauthorized status check: {status_no_auth} (expected 401)")
    if status_no_auth != 401:
        print("FAIL: Permitiu requisição sem JWT.")
        success = False

    # 3. Events List
    status_evt, body_evt = request_api("/api/v1/eventos", headers=headers)
    print(f"Events List status: {status_evt} | Count: {len(body_evt)}")
    if status_evt != 200 or not isinstance(body_evt, list):
        print("FAIL: Falha ao listar eventos reais.")
        success = False

    # 4. Event by ID (Success and Not Found)
    if status_evt == 200 and len(body_evt) > 0:
        evt_id = body_evt[0]["id"]
        status_detail, body_detail = request_api(f"/api/v1/eventos/{evt_id}", headers=headers)
        print(f"Event detail status: {status_detail} | title: {body_detail.get('titulo')}")
        if status_detail != 200 or body_detail.get("id") != evt_id:
            print("FAIL: Falha ao carregar detalhes do evento.")
            success = False
            
    # Event Not Found
    status_nf, body_nf = request_api("/api/v1/eventos/00000000-0000-0000-0000-000000000000", headers=headers)
    print(f"Event Not Found status: {status_nf} (expected 404)")
    if status_nf != 404 or body_nf.get("code") != "EVENT_NOT_FOUND":
        print("FAIL: Formato de erro ou status de 404 inválido.")
        success = False

    # 5. Indicators List
    status_ind, body_ind = request_api("/api/v1/indicadores", headers=headers)
    print(f"Indicators status: {status_ind} | Count: {len(body_ind)}")
    if status_ind != 200 or not isinstance(body_ind, list):
        print("FAIL: Falha ao buscar indicadores.")
        success = False

    # 6. Companies Listing
    status_comp, body_comp = request_api("/api/v1/empresas", headers=headers)
    print(f"Companies listing status: {status_comp} | Count: {len(body_comp.get('items', [])) if isinstance(body_comp, dict) else 0}")
    if status_comp != 200 or not isinstance(body_comp, dict) or not isinstance(body_comp.get("items"), list):
        print("FAIL: Falha ao listar empresas.")
        success = False

    # 7. Opportunities Listing
    status_opp, body_opp = request_api("/api/v1/oportunidades", headers=headers)
    print(f"Opportunities status: {status_opp} | Count: {len(body_opp.get('items', [])) if isinstance(body_opp, dict) else 0}")
    if status_opp != 200 or not isinstance(body_opp, dict) or not isinstance(body_opp.get("items"), list):
        print("FAIL: Falha ao buscar oportunidades.")
        success = False

    # Kill Uvicorn Server
    server_process.terminate()
    server_process.wait()
    print("FastAPI test server terminated.")
    
    assert success, "ERRO EM UM OU MAIS TESTES DE BACKEND!"
    print("TODOS OS TESTES DE BACKEND PASSARAM COM SUCESSO!")

if __name__ == "__main__":
    test_api_endpoints()
