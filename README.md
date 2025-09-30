# AgriChain – Hedera-native Custody & Escrow System

AgriChain is a suite of apps that cut **post-harvest losses** in Sub-Saharan Africa by providing **tokenized receipts, custody tracking, and escrow payments** on **Hedera Hashgraph**.

* **Farmer App** → mint harvest batch NFTs (HTS) with GPS + photo metadata.
* **Transporter App** → scan QR codes, sign & log custody events.
* **Warehouse/Inspector App** → confirm delivery, record inspections, re-weighs.
* **Buyer Portal** → escrow deposits, delivery confirmation, dispute management.
* **Admin Dashboard** → monitor custody flows, KPIs, and pilot metrics.

---

## 🚩 Problem

Farmers lose **10–30%** of harvest to spoilage, theft, and opaque chains (FAO/APHLIS). Buyers face disputes and delays due to lack of traceability.

---

## ✅ Solution

* **NFT receipts** → tokenized harvest batches with off-chain IPFS metadata.
* **Custody logs** → every pickup/delivery logged via **HCS** with trusted timestamps.
* **Escrow payments** → funds released on multi-party confirmation (2-of-3 signatures).
* **Offline-first apps** → React Native, QR-based flows for low-connectivity regions.

---

## 📂 Project Structure

```bash
agri-chain/
├── farmer-app/           # React Native app for farmers (mint batch receipts)
├── transporter-app/      # React Native app for transport custody
├── warehouse-app/        # React Native app for warehouse/inspector
├── buyer-portal/         # Web app for buyers & escrow flows
├── admin-dashboard/      # Web app for monitoring & KPIs
├── contracts/            # Hedera EVM smart contracts (escrow, token logic)
├── scripts/              # Seeding scripts for demo (testnet farms, custody events)
├── docs/                 # Whitepaper, diagrams, pitch assets
└── README.md             # You are here
```

---

## ⚙️ Setup & Installation

### 1. Clone repo

```bash
git clone https://github.com/YOUR_USERNAME/agrichain.git
cd agrichain
```

### 2. Install dependencies

Each app is independent:

```bash
cd farmer-app && npm install
cd ../transporter-app && npm install
cd ../warehouse-app && npm install
cd ../buyer-portal && npm install
cd ../admin-dashboard && npm install
```

### 3. Environment setup

Create a `.env` file in each app with:

```env
HEDERA_OPERATOR_ID=0.0.xxxx
HEDERA_OPERATOR_KEY=302e0201...
IPFS_GATEWAY=https://ipfs.infura.io
ESCROW_CONTRACT=0x....
```

### 4. Run locally

```bash
npm start          # for React Native apps (Expo)
npm run dev        # for Next.js buyer/admin dashboards
```

### 5. EAS build (Expo Application Services)

```bash
expo build:android
expo build:ios
```

---

## 🎥 Demo

* **Seeding script:**

```bash
cd scripts
node seed.js
```

Populates testnet with:

* 5 farms, 10 custody events

* Escrow deposit + release event


---

## 🛠️ Tech Stack

* **Blockchain:** Hedera HTS, HCS, EVM contracts
* **Mobile:** React Native + Expo (offline-ready)
* **Web:** PHP + Tailwind, HTML
* **Storage:** IPFS (encrypted PII off-chain)
* **Backend:** Node.js API (custodial escrow MVP)

---

## 🚀 Roadmap

* [x] Testnet MVP (NFT mint, custody logs, escrow release)
* [X] Production pilot with cooperative aggregator
* [ ] Smart contract escrow (Hedera EVM)
* [ ] AI assistant integration (voice guidance for farmers)
* [ ] Analytics dashboard (spoilage reduction, custody KPIs)

---

## 🤝 Contribution

We welcome collaborators! Current needs:

* UI/UX Designer
* Hedera EVM Developer (escrow contracts)
* Data Scientist (dashboards, KPIs)

---
**This project is still under debugging and correction. The DIRA team acknowledges that there may be errors in the files and is currently working on perfecting these project files.
  These changes include, but are not limited to, AI integration for actual automation using DIRA customized AI systems at minimal costs for easy execution of the app chain sequence.

## 📜 License

MIT License — Strictly the property of DIRA.

