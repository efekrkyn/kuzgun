<div align="center">
  <img src="https://raw.githubusercontent.com/efekrkyn/kuzgun/main/public/kuzgun-logo.png" alt="KUZGUN Logo" width="600" />
  
  # KUZGUN Intelligence Platform
  **Advanced OSINT & Global Awareness Dashboard**

  [![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript)](https://www.typescriptlang.org/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

</div>

## 👁️ Overview

KUZGUN is an enterprise-grade, open-source intelligence (OSINT) and global awareness platform. Built with Next.js and WebGL, it provides a "Single Pane of Glass" for security researchers, analysts, and red teamers to conduct passive reconnaissance and monitor global events in real-time.

It bridges the gap between CLI-based hacking tools and expensive commercial intelligence software (like Maltego or Palantir) by offering an interactive, cinematic 3D interface and an AI-powered autonomous agent.

## 🚀 Key Features

- **3D Tactical Map (Osiris Map):** Real-time global tracking of flights, maritime traffic, active wildfires, earthquakes, and geopolitical conflicts.
- **Dynamic Entity Graph:** A Maltego-style interactive correlation graph. Click on an IP, domain, or Telegram user to autonomously expand nodes and discover hidden connections.
- **Autonomous AI Agent:** Powered by DeepSeek, the agent dynamically selects and chains OSINT tools based on natural language prompts, delivering comprehensive Red Team reports.
- **40+ Modular OSINT Tools:**
  - **Infrastructure:** Subdomain enumeration, Port scanning, DNS/WHOIS, BGP routing.
  - **SOCMINT (Social Media):** Username hunting (1400+ sites), Telegram crypto-wallet extraction, Twitter/Instagram scraping.
  - **Identities:** Email to Google Account correlation (GHunt logic), leak checks.
  - **Dark Web & Threat Intel:** Ahmia Tor indexing, CT logs phishing catcher, Abuse.ch malware feeds.

## 🛠️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/efekrkyn/kuzgun.git
   cd kuzgun
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the root directory and add your API keys (e.g., DeepSeek API key, Abuse.ch Auth-Key). *Note: The `.env` file is gitignored for your safety.*

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🤝 Credits & Inspirations

KUZGUN's intelligence modules were built using a clean-room design approach, heavily inspired by the logic and concepts of the following incredible open-source projects. We extend our deepest gratitude to the original authors and the open-source cybersecurity community:

- **[Photon](https://github.com/s0md3v/Photon)** by s0md3v - For web crawling and extraction logic.
- **[GHunt](https://github.com/mxrch/GHunt)** by mxrch - For Google account OSINT methodologies.
- **[ParamSpider](https://github.com/devanshbatham/ParamSpider)** by devanshbatham - For Wayback Machine parameter mining concepts.
- **[Sn0int](https://github.com/kpcyrd/sn0int)** & **[Maltego](https://www.maltego.com/)** - For the entity graph and autonomous node expansion workflow.
- **[Phishing Catcher](https://github.com/x0rz/phishing_catcher)** by x0rz - For Certificate Transparency (CT) log monitoring logic.

*This project is for educational and defensive security research purposes only. Always ensure you have authorization before actively scanning targets.*

## 📜 License
This project is licensed under the MIT License.
