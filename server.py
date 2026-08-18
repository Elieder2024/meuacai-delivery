import http.server
import socketserver
import json
import os
import time

PORT = int(os.environ.get('PORT', 3002))
DATA_DIR = os.path.dirname(os.path.abspath(__file__))

ORDERS_FILE = os.path.join(DATA_DIR, "orders.json")
ACAI_SIZES_FILE = os.path.join(DATA_DIR, "acai_sizes.json")
COMPLEMENTS_FILE = os.path.join(DATA_DIR, "complements.json")
TOPPINGS_FILE = os.path.join(DATA_DIR, "toppings.json")
DRINKS_FILE = os.path.join(DATA_DIR, "drinks.json")
CUSTOMERS_FILE = os.path.join(DATA_DIR, "customers.json")
REWARDS_FILE = os.path.join(DATA_DIR, "rewards.json")
STORE_HOURS_FILE = os.path.join(DATA_DIR, "store_hours.json")

DEFAULT_STORE_HOURS = {
  "manualStatus": "auto",
  "openTime": "11:00",
  "closeTime": "23:00",
  "daysOpen": [0, 1, 2, 3, 4, 5, 6],
  "closedMessage": "🔴 Loja Fechada no Momento! Nosso horário de funcionamento é das 11:00 às 23:00. Fique à vontade para olhar nosso cardápio!"
}

DEFAULT_ORDERS = [
  {
    "id": "ACAI-101",
    "clientName": "Cliente Centro BC",
    "clientPhone": "47999998888",
    "address": "Av. Brasil, 1200 - Centro, Balneário Camboriú",
    "items": "1x Copo 500ml (Açaí Tradicional, Banana, Morango, Leite Ninho, Nutella Original)",
    "total": 22.50,
    "paymentMethod": "PIX",
    "status": "EM_PREPARO",
    "date": "Hoje, 14:30"
  }
]

DEFAULT_ACAI_SIZES = {
  "copo300": 19.99,
  "copo500": 25.99,
  "copo700": 32.99
}

DEFAULT_COMPLEMENTS = [
  { "id": "comp_1", "name": "🍌 Banana Fatiada", "desc": "Banana prata fatiada na hora" },
  { "id": "comp_2", "name": "🍓 Morango Fresco", "desc": "Morangos frescos fatiados" },
  { "id": "comp_3", "name": "🥛 Leite em Pó (Ninho)", "desc": "Leite em pó polvilhado" },
  { "id": "comp_4", "name": "🌾 Granola Crocante", "desc": "Granola crocante" },
  { "id": "comp_5", "name": "🍯 Leite Condensado", "desc": "Leite condensado" }
]

DEFAULT_TOPPINGS = [
  { "id": "top_1", "name": "🌰 Nutella Original", "price": 7.00, "icon": "🌰" },
  { "id": "top_9", "name": "🥝 Kiwi Fresco", "price": 4.00, "icon": "🥝" }
]

DEFAULT_DRINKS = [
  { "id": "drk_1", "name": "🥤 Coca-Cola Lata 350ml", "price": 8.00, "icon": "🥤" },
  { "id": "drk_2", "name": "🍋 Guaraná Antarctica 350ml", "price": 8.00, "icon": "🥤" },
  { "id": "drk_4", "name": "💧 Água Mineral sem Gás 500ml", "price": 3.00, "icon": "💧" }
]

DEFAULT_CUSTOMERS = [
  {
    "phone": "47999998888",
    "name": "Cliente Açaí BC",
    "email": "cliente@meuacai.com.br",
    "password": "123",
    "points": 85,
    "createdAt": "2026-08-15"
  }
]

DEFAULT_REWARDS = [
  { "id": "rew_1", "name": "🌰 Adicional de Nutella Grátis", "points": 40, "desc": "Porção extra de Nutella Original no seu açaí", "type": "extra", "value": 4.50, "icon": "🌰" },
  { "id": "rew_2", "name": "🥤 Refrigerante ou Água Grátis", "points": 50, "desc": "Qualquer bebida lata do cardápio", "type": "drink", "value": 5.00, "icon": "🥤" },
  { "id": "rew_3", "name": "💰 Cupom de R$ 10,00 de Desconto", "points": 100, "desc": "Desconto de R$ 10,00 no total do pedido", "type": "discount", "value": 10.00, "icon": "🏷️" },
  { "id": "rew_4", "name": "🍧 Copo 300ml de Açaí Grátis", "points": 140, "desc": "1x Copo 300ml com 3 acompanhamentos à escolha", "type": "acai", "value": 14.00, "icon": "🍧" }
]

def load_json_file(filepath, default_data):
    if not os.path.exists(filepath):
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(default_data, f, ensure_ascii=False, indent=2)
        return default_data
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default_data

def save_json_file(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# Force sync catalog config on server startup to guarantee live updates
try:
    save_json_file(ACAI_SIZES_FILE, DEFAULT_ACAI_SIZES)
    save_json_file(COMPLEMENTS_FILE, DEFAULT_COMPLEMENTS)
    save_json_file(TOPPINGS_FILE, DEFAULT_TOPPINGS)
    save_json_file(DRINKS_FILE, DEFAULT_DRINKS)
    save_json_file(REWARDS_FILE, DEFAULT_REWARDS)
except Exception:
    pass

class MeuAcaiRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Bypass-Tunnel-Reminder', '1')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split('?')[0]

        if clean_path in ['/manifest.json', '/manifest.webmanifest']:
            filepath = os.path.join(os.path.dirname(__file__), 'manifest.json')
            if os.path.exists(filepath):
                with open(filepath, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/manifest+json; charset=utf-8')
                self.end_headers()
                self.wfile.write(content)
                return

        if clean_path in ['/sw.js', '/service-worker.js']:
            filepath = os.path.join(os.path.dirname(__file__), 'sw.js')
            if os.path.exists(filepath):
                with open(filepath, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/javascript; charset=utf-8')
                self.end_headers()
                self.wfile.write(content)
                return

        if clean_path in ['/icon-192.png', '/icon-512.png']:
            filename = os.path.basename(clean_path)
            filepath = os.path.join(os.path.dirname(__file__), filename)
            if os.path.exists(filepath):
                with open(filepath, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'image/png')
                self.end_headers()
                self.wfile.write(content)
                return

        if self.path == '/api/orders':
            orders = load_json_file(ORDERS_FILE, DEFAULT_ORDERS)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(orders, ensure_ascii=False).encode('utf-8'))
            return

        if self.path == '/api/acai-sizes':
            sizes = load_json_file(ACAI_SIZES_FILE, DEFAULT_ACAI_SIZES)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(sizes, ensure_ascii=False).encode('utf-8'))
            return

        if self.path == '/api/complements':
            comps = load_json_file(COMPLEMENTS_FILE, DEFAULT_COMPLEMENTS)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(comps, ensure_ascii=False).encode('utf-8'))
            return

        if self.path == '/api/toppings':
            topps = load_json_file(TOPPINGS_FILE, DEFAULT_TOPPINGS)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(topps, ensure_ascii=False).encode('utf-8'))
            return

        if self.path == '/api/drinks':
            drinks = load_json_file(DRINKS_FILE, DEFAULT_DRINKS)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(drinks, ensure_ascii=False).encode('utf-8'))
            return

        if self.path == '/api/customers/list':
            customers = load_json_file(CUSTOMERS_FILE, DEFAULT_CUSTOMERS)
            safe_cust = []
            for c in customers:
                safe_cust.append({
                    "phone": c.get("phone"),
                    "name": c.get("name"),
                    "email": c.get("email"),
                    "points": c.get("points", 0),
                    "createdAt": c.get("createdAt", "")
                })
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(safe_cust, ensure_ascii=False).encode('utf-8'))
            return

        if self.path == '/api/store-hours':
            hours = load_json_file(STORE_HOURS_FILE, DEFAULT_STORE_HOURS)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(hours, ensure_ascii=False).encode('utf-8'))
            return

        if self.path == '/api/rewards':
            rewards = load_json_file(REWARDS_FILE, DEFAULT_REWARDS)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(rewards, ensure_ascii=False).encode('utf-8'))
            return

        super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        
        try:
            req_data = json.loads(body) if body else {}
        except Exception:
            req_data = {}

        # ORDERS (Save order and credit loyalty points: 1 pt per R$ 1.00)
        if self.path == '/api/orders':
            orders = load_json_file(ORDERS_FILE, DEFAULT_ORDERS)
            orders.insert(0, req_data)
            save_json_file(ORDERS_FILE, orders)

            cust_phone = req_data.get('clientPhone', '').strip()
            total_spent = float(req_data.get('total', 0))
            pts_earned = int(total_spent)

            if cust_phone and pts_earned > 0:
                customers = load_json_file(CUSTOMERS_FILE, DEFAULT_CUSTOMERS)
                for c in customers:
                    if c.get('phone') == cust_phone:
                        c['points'] = c.get('points', 0) + pts_earned
                        save_json_file(CUSTOMERS_FILE, customers)
                        break

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "message": "Pedido de Açaí recebido na loja!"}).encode('utf-8'))
            return

        if self.path == '/api/store-hours':
            hours = req_data
            save_json_file(STORE_HOURS_FILE, hours)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "storeHours": hours}, ensure_ascii=False).encode('utf-8'))
            return

        if self.path == '/api/orders/update-status':
            order_id = req_data.get('id')
            new_status = req_data.get('status')
            orders = load_json_file(ORDERS_FILE, DEFAULT_ORDERS)
            for o in orders:
                if o.get('id') == order_id:
                    o['status'] = new_status
                    break
            save_json_file(ORDERS_FILE, orders)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "orders": orders}).encode('utf-8'))
            return

        # ACAI SIZES
        if self.path == '/api/acai-sizes':
            sizes = load_json_file(ACAI_SIZES_FILE, DEFAULT_ACAI_SIZES)
            if 'copo300' in req_data: sizes['copo300'] = float(req_data['copo300'])
            if 'copo500' in req_data: sizes['copo500'] = float(req_data['copo500'])
            if 'copo700' in req_data: sizes['copo700'] = float(req_data['copo700'])
            if 'tigela1000' in req_data: sizes['tigela1000'] = float(req_data['tigela1000'])
            save_json_file(ACAI_SIZES_FILE, sizes)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "sizes": sizes}).encode('utf-8'))
            return

        # COMPLEMENTS
        if self.path == '/api/complements':
            comps = load_json_file(COMPLEMENTS_FILE, DEFAULT_COMPLEMENTS)
            if req_data.get('id'):
                updated = False
                for c in comps:
                    if c.get('id') == req_data.get('id'):
                        c['name'] = req_data.get('name', c['name'])
                        c['desc'] = req_data.get('desc', c['desc'])
                        updated = True
                        break
                if not updated:
                    comps.append(req_data)
            else:
                req_data['id'] = 'comp_' + str(int(os.urandom(4).hex(), 16))
                comps.append(req_data)

            save_json_file(COMPLEMENTS_FILE, comps)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "complements": comps}).encode('utf-8'))
            return

        if self.path == '/api/complements/delete':
            comp_id = req_data.get('id')
            comps = load_json_file(COMPLEMENTS_FILE, DEFAULT_COMPLEMENTS)
            comps = [c for c in comps if c.get('id') != comp_id]
            save_json_file(COMPLEMENTS_FILE, comps)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "complements": comps}).encode('utf-8'))
            return

        # TOPPINGS
        if self.path == '/api/toppings':
            topps = load_json_file(TOPPINGS_FILE, DEFAULT_TOPPINGS)
            if req_data.get('id'):
                updated = False
                for t in topps:
                    if t.get('id') == req_data.get('id'):
                        t['name'] = req_data.get('name', t['name'])
                        t['price'] = float(req_data.get('price', t['price']))
                        updated = True
                        break
                if not updated:
                    topps.append(req_data)
            else:
                req_data['id'] = 'top_' + str(int(os.urandom(4).hex(), 16))
                topps.append(req_data)

            save_json_file(TOPPINGS_FILE, topps)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "toppings": topps}).encode('utf-8'))
            return

        if self.path == '/api/toppings/delete':
            top_id = req_data.get('id')
            topps = load_json_file(TOPPINGS_FILE, DEFAULT_TOPPINGS)
            topps = [t for t in topps if t.get('id') != top_id]
            save_json_file(TOPPINGS_FILE, topps)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "toppings": topps}).encode('utf-8'))
            return

        # DRINKS
        if self.path == '/api/drinks':
            drinks = load_json_file(DRINKS_FILE, DEFAULT_DRINKS)
            if req_data.get('id'):
                updated = False
                for d in drinks:
                    if d.get('id') == req_data.get('id'):
                        d['name'] = req_data.get('name', d['name'])
                        d['price'] = float(req_data.get('price', d['price']))
                        updated = True
                        break
                if not updated:
                    drinks.append(req_data)
            else:
                req_data['id'] = 'drink_' + str(int(os.urandom(4).hex(), 16))
                drinks.append(req_data)

            save_json_file(DRINKS_FILE, drinks)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "drinks": drinks}).encode('utf-8'))
            return

        if self.path == '/api/drinks/delete':
            drink_id = req_data.get('id')
            drinks = load_json_file(DRINKS_FILE, DEFAULT_DRINKS)
            drinks = [d for d in drinks if d.get('id') != drink_id]
            save_json_file(DRINKS_FILE, drinks)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "drinks": drinks}).encode('utf-8'))
            return

        # CUSTOMERS
        if self.path == '/api/customers/register':
            phone = str(req_data.get('phone', '')).strip().replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
            name = req_data.get('name', '').strip()
            email = req_data.get('email', '').strip().lower()
            password = req_data.get('password', '').strip()

            if not phone or not name or not password:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Preencha Nome, WhatsApp e Senha."}).encode('utf-8'))
                return

            customers = load_json_file(CUSTOMERS_FILE, DEFAULT_CUSTOMERS)
            for c in customers:
                if c.get('phone') == phone:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "Este número de WhatsApp já possui conta cadastrada."}).encode('utf-8'))
                    return

            new_c = {
                "phone": phone,
                "name": name,
                "email": email,
                "password": password,
                "points": 20,
                "createdAt": time.strftime("%Y-%m-%d")
            }
            customers.append(new_c)
            save_json_file(CUSTOMERS_FILE, customers)

            safe_info = { "phone": new_c["phone"], "name": new_c["name"], "email": new_c["email"], "points": new_c["points"] }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "customer": safe_info, "message": "Conta criada com sucesso! Você ganhou 20 pontos de bônus!"}).encode('utf-8'))
            return

        if self.path == '/api/customers/login':
            phone = str(req_data.get('phone', '')).strip().replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
            password = req_data.get('password', '').strip()

            customers = load_json_file(CUSTOMERS_FILE, DEFAULT_CUSTOMERS)
            found = None
            for c in customers:
                if c.get('phone') == phone and c.get('password') == password:
                    found = c
                    break

            if not found:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "WhatsApp ou senha incorretos."}).encode('utf-8'))
                return

            safe_info = { "phone": found["phone"], "name": found["name"], "email": found["email"], "points": found["points"] }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "customer": safe_info}).encode('utf-8'))
            return

        if self.path == '/api/customers/update-points':
            phone = req_data.get('phone')
            new_points = int(req_data.get('points', 0))
            customers = load_json_file(CUSTOMERS_FILE, DEFAULT_CUSTOMERS)
            for c in customers:
                if c.get('phone') == phone:
                    c['points'] = new_points
                    break
            save_json_file(CUSTOMERS_FILE, customers)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok"}).encode('utf-8'))
            return

        if self.path == '/api/customers/redeem':
            phone = req_data.get('phone')
            points_cost = int(req_data.get('points', 0))
            customers = load_json_file(CUSTOMERS_FILE, DEFAULT_CUSTOMERS)
            cust = None
            for c in customers:
                if c.get('phone') == phone:
                    cust = c
                    break

            if not cust or cust.get('points', 0) < points_cost:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Saldo de pontos insuficiente."}).encode('utf-8'))
                return

            cust['points'] -= points_cost
            save_json_file(CUSTOMERS_FILE, customers)
            safe_info = { "phone": cust["phone"], "name": cust["name"], "email": cust["email"], "points": cust["points"] }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "customer": safe_info}).encode('utf-8'))
            return

        # REWARDS CRUD
        if self.path == '/api/rewards':
            rewards = load_json_file(REWARDS_FILE, DEFAULT_REWARDS)
            if req_data.get('id'):
                updated = False
                for r in rewards:
                    if r.get('id') == req_data.get('id'):
                        r['name'] = req_data.get('name', r['name'])
                        r['points'] = int(req_data.get('points', r['points']))
                        r['value'] = float(req_data.get('value', r.get('value', 0)))
                        updated = True
                        break
                if not updated:
                    rewards.append(req_data)
            else:
                req_data['id'] = 'rew_' + str(int(os.urandom(4).hex(), 16))
                rewards.append(req_data)

            save_json_file(REWARDS_FILE, rewards)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "rewards": rewards}).encode('utf-8'))
            return

        if self.path == '/api/rewards/delete':
            rew_id = req_data.get('id')
            rewards = load_json_file(REWARDS_FILE, DEFAULT_REWARDS)
            rewards = [r for r in rewards if r.get('id') != rew_id]
            save_json_file(REWARDS_FILE, rewards)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "rewards": rewards}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

if __name__ == '__main__':
    load_json_file(ORDERS_FILE, DEFAULT_ORDERS)
    load_json_file(ACAI_SIZES_FILE, DEFAULT_ACAI_SIZES)
    load_json_file(COMPLEMENTS_FILE, DEFAULT_COMPLEMENTS)
    load_json_file(TOPPINGS_FILE, DEFAULT_TOPPINGS)
    load_json_file(DRINKS_FILE, DEFAULT_DRINKS)
    load_json_file(CUSTOMERS_FILE, DEFAULT_CUSTOMERS)
    load_json_file(REWARDS_FILE, DEFAULT_REWARDS)
    os.chdir(DATA_DIR)
    
    with socketserver.TCPServer(("", PORT), MeuAcaiRequestHandler) as httpd:
        print(f"Servidor MeuAçai rodando em http://localhost:{PORT}")
        httpd.serve_forever()
