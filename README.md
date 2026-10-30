# Huawei Network Manager — Sistema de Provisionamento e Gerenciamento ISP

Sistema web completo e funcional para gerenciamento, descoberta SSH e provisionamento simplificado de switches e roteadores **Huawei VRP** (`CloudEngine S6730`, `S5735`, `NetEngine 8000`) utilizados em provedores de internet (ISPs).

---

## Principais Funcionalidades

1. **Dashboard Operacional ISP**:
   - Indicadores em tempo real de POPs cadastrados, equipamentos online/offline, interfaces físicas, VLANs, Vlanifs, rotas estáticas, últimas configurações e auditoria.
   - Identificação explícita entre modo de demonstração (Simulador VRP) e modo de produção (SSH real via Netmiko).
2. **Gerenciamento de POPs**:
   - Cadastro, edição e exclusão de POPs (`POP MOTIRO`, `POP SILVINA`, `POP CORE-SP`, `POP VILA SÃO PEDRO`), listando automaticamente os equipamentos associados ao selecionar um POP.
3. **Cadastro de Equipamentos Huawei e Operações SSH**:
   - Armazenamento de credenciais com criptografia simétrica **Fernet (AES-128-CBC + HMAC-SHA256)** em repouso.
   - Senhas SSH nunca são enviadas ao frontend após o cadastro e nunca aparecem nos logs.
   - Botões operacionais integrados: **Testar conexão**, **Conectar**, **Sincronizar informações**, **Consultar configuração** e **Visualizar interfaces**.
4. **Mapa Visual Interativo das Portas (1 a 48)**:
   - Representação gráfica fiel às interfaces reais descobertas no equipamento (`XGigabitEthernet0/0/1` a `48`), com cores padronizadas:
     - **Verde**: Interface UP
     - **Cinza**: Interface DOWN
     - **Vermelho**: Erro físico / CRC crítico
     - **Amarelo**: Alerta
     - **Azul**: Interface selecionada
   - Ao clicar em qualquer porta, exibe status administrativo/físico, velocidade, duplex, MTU, modo (`Access`, `Trunk`, `Hybrid`), PVID, VLANs permitidas, tráfego RX/TX, erros e configuração VRP, além do botão **Configurar esta porta**.
5. **Assistente de Provisionamento em Tela Única (6 Etapas)**:
   - **Etapa 1**: Escolher POP
   - **Etapa 2**: Escolher Switch Huawei
   - **Etapa 3**: Escolher Porta (via dropdown ou clicando no Mapa Visual de Portas)
   - **Etapa 4**: Configurar VLAN e modo da interface (`Access`, `Trunk` preservando VLANs existentes, ou `Hybrid`)
   - **Etapa 5**: Criar interface L3 `Vlanif` (IPv4, máscara/CIDR, opção Dual-Stack IPv6 e VRF)
   - **Etapa 6**: Configurar uma ou múltiplas Rotas Estáticas (`ip route-static` / `ipv6 route-static`) para blocos públicos de clientes (`/30`, `/29`, `/28`, etc.), permitindo selecionar outro equipamento Layer 3 de destino caso o switch de acesso seja puramente Layer 2.
6. **Prévia Lado a Lado, Diff e Execução SSH Segura (14 Passos)**:
   - Comparação lado a lado (**Configuração Atual** vs **Configuração Proposta**) com destaque de linhas adicionadas, removidas e modificadas.
   - Terminal Huawei VRP com destaque de sintaxe, botões **Copiar**, **Validar** e **Aplicar configuração** mediante confirmação explícita, lock de concorrência por equipamento e backup automático pré-alteração.

---

## Estrutura do Projeto

```text
├── frontend/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── types/
├── backend/
│   ├── api/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── drivers/
│   │   └── huawei/
│   ├── security/
│   ├── tasks/
│   └── tests/
├── migrations/
├── docker-compose.yml
├── nginx.conf
├── .env.example
└── README.md
```

---

## Como Executar

### Opção 1: Execução Local Rápida (Desenvolvimento)

**1. Iniciar o Backend (FastAPI):**
```powershell
.\.venv\Scripts\uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
- Documentação Swagger/OpenAPI: `http://localhost:8000/docs`

**2. Iniciar o Frontend (Next.js):**
```powershell
cd frontend
npm run dev
```
- Acesse o painel em: `http://localhost:3000`

### Opção 2: Docker Compose (PostgreSQL + Redis + Backend + Frontend + Nginx)

```bash
docker compose up --build -d
```
- Painel via Nginx Reverse Proxy: `http://localhost:8080`
- Frontend direto: `http://localhost:3000`
- API Backend: `http://localhost:8000/docs`

---

## Credenciais Padrão (RBAC)

| Usuário | Senha | Perfil | Permissões |
|---|---|---|---|
| `admin` | `Huawei@2026` | **Administrador** | Acesso total (POPs, Equipamentos, Provisionamento SSH, Rotas, Usuários e Configurações) |
| `engenheiro` | `Huawei@2026` | **Engenheiro de Rede** | Provisionamento SSH, Cadastro de POPs/Equipamentos e Gerenciamento de Rotas |
| `operador` | `Huawei@2026` | **Operador Somente Leitura** | Visualização de Dashboard, Mapa de Portas, Rotas e Simulação de Prévias (bloqueado para aplicar via SSH) |

---

## Executando os Testes Automatizados

```powershell
.\.venv\Scripts\pytest backend/tests/test_huawei_manager.py -v
```

