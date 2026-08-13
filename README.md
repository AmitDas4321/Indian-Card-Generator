<p align="center">
  <img src="./public/assets/banner.png" alt="Indian Card Generator Banner" width="900">
</p>

<h1 align="center">
  🇮🇳 Indian Card Generator
</h1>

<p align="center">
  <strong>A modern, fast, privacy-first browser-based card generator with a beautiful Indian-inspired design.</strong>
</p>

<p align="center">
  <a href="https://github.com/AmitDas4321/Indian-Card-Generator">
    <img src="https://img.shields.io/github/stars/AmitDas4321/Indian-Card-Generator?style=for-the-badge" alt="GitHub Stars">
  </a>
  <a href="https://github.com/AmitDas4321/Indian-Card-Generator/network/members">
    <img src="https://img.shields.io/github/forks/AmitDas4321/Indian-Card-Generator?style=for-the-badge" alt="GitHub Forks">
  </a>
  <a href="https://github.com/AmitDas4321/Indian-Card-Generator/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/AmitDas4321/Indian-Card-Generator?style=for-the-badge" alt="License">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/TailwindCSS-4-38BDF8?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/HTML5_Canvas-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5 Canvas">
</p>

---

# 🇮🇳 About

**Indian Card Generator** is a modern, fast, and privacy-focused browser-based card generator designed with a beautiful Indian-inspired visual aesthetic.

The application allows users to create customizable identity-style cards directly in their browser using personal information, photographs, QR codes, and decorative Indian-themed design elements.

The card-generation workflow is designed to run on the client side, without requiring a traditional backend or database for generating cards.

> ⚠️ **IMPORTANT DISCLAIMER**
>
> This application is intended solely for **personal, novelty, organizational, educational, or event identity card creation**.
>
> **Generated cards are NOT official Government of India documents or identity cards**, including Aadhaar, PAN, Voter ID, Passport, Driving Licence, or any other government-issued identification.
>
> These cards have **no official or legal validity**.

---

# 🌟 Experience

The card creation process is designed to be simple, interactive, and fast.

```text
📝 Enter Card Details

        │
        ▼

📸 Upload Photograph

        │
        ▼

🇮🇳 Apply Indian-Inspired Theme

        │
        ▼

🔳 Generate QR Code

        │
        ▼

⚡ Real-Time Canvas Rendering

        │
        ▼

👀 Preview Your Card

        │
        ▼

📥 Download HD PNG

        │
        ▼

🎉 Download Celebration
````

---

# ✨ Features

* 🇮🇳 **Indian-Inspired Design**
* 🎨 Tiranga-inspired saffron, white & green colors
* 🌀 Ashoka Chakra inspired decorative elements
* ✨ Golden ornamental accents
* 🖼️ Custom photograph upload
* ✂️ Automatic photo cropping
* 🔳 QR code support
* ⚡ Real-time live card preview
* 🖌️ HTML5 Canvas rendering
* 📥 High-resolution PNG export
* 🖨️ 1600 × 1000 px HD card output
* 🔒 Client-side card generation
* 🚫 No required backend
* 🚫 No required database
* 📱 Fully responsive design
* 💻 Desktop & laptop support
* 📲 Mobile & tablet support
* 🔄 Browser autofill support
* 🎉 Confetti download animation
* 🌐 Works directly in modern browsers

---

# 🖼️ Preview

## 🇮🇳 Card Preview

<p align="center">
  <img src="./public/assets/card-preview.png" width="800" alt="Indian Card Generator Card Preview">
</p>

## 📝 Generator Interface

<p align="center">
  <img src="./public/assets/generator-preview.png" width="800" alt="Indian Card Generator Interface">
</p>

> Replace the screenshot filenames above with your actual screenshot filenames if needed.

---

# 🎨 Design

Indian Card Generator uses an Indian-inspired visual system combining patriotic colors, elegant typography, decorative patterns, and modern UI components.

### 🇮🇳 Primary Colors

```text
Deep Navy
#060B18

Dark Navy
#0B1224

Indian Saffron
#FF9933

Indian Green
#138808

Golden Accent
#D4AF37

White
#FFFFFF
```

### 🎨 Design Elements

* 🇮🇳 Tiranga-inspired gradients
* 🌀 Ashoka Chakra inspired patterns
* ✨ Golden decorative accents
* 🖼️ Rounded photo container
* 🔳 QR code section
* 🏷️ Structured information layout
* 💧 Subtle background watermarks
* 🖌️ Decorative borders
* 📐 High-resolution Canvas rendering

---

# ⚙️ How It Works

## 1. Enter Information

Users can enter customizable card information such as:

```text
Name
ID Number
Phone Number
Address
Date of Birth
Blood Group
Organization
Other Custom Details
```

---

## 2. Upload Photograph

Users can upload a profile photograph in common image formats:

```text
JPEG
PNG
WebP
```

The image can be processed locally before being rendered onto the card.

---

## 3. Generate Card

The application combines the provided information, photograph, QR code, and design elements.

```text
User Information
       +
Photograph
       +
QR Code
       +
Indian Theme
       ↓
HTML5 Canvas
       ↓
1600 × 1000 px
       ↓
HD PNG Card
```

---

## 4. Live Preview

Every change made in the form can be reflected in the card preview.

```text
User Input
    ↓
React State
    ↓
Card Renderer
    ↓
HTML5 Canvas
    ↓
Live Preview
```

---

## 5. Download

The generated Canvas is converted into a PNG image.

Example:

```text
indian-card-1723567890123.png
```

A celebration animation can be triggered after a successful download.

---

# 🔒 Privacy First

Privacy is one of the core principles of the project.

The card-generation workflow is designed to process user-provided information locally in the browser.

```text
┌──────────────────────┐
│        USER          │
│                      │
│  Name                │
│  Photo               │
│  Card Information    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│      BROWSER         │
│                      │
│  React               │
│  Canvas              │
│  Image Processing    │
│  QR Generation       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    GENERATED CARD    │
│                      │
│      PNG IMAGE       │
└──────────────────────┘
```

### Privacy Principles

* 🔒 Card generation is client-side
* 📸 Photos can be processed locally
* 🚫 No required card-generation backend
* 🚫 No required database
* 🚫 No account required
* 🧠 Image processing happens in browser memory
* 🖥️ Canvas rendering happens locally

> **Note:** The privacy characteristics of the application itself do not automatically cover third-party hosting, CDN, analytics, fonts, or other external services used by a deployment.

---

# 🛠️ Tech Stack

| Technology          | Purpose                                    |
| ------------------- | ------------------------------------------ |
| **React 18**        | UI rendering and state management          |
| **TypeScript**      | Type-safe development                      |
| **Vite 6**          | Development server and production bundling |
| **Tailwind CSS 4**  | Modern responsive styling                  |
| **HTML5 Canvas**    | High-resolution card rendering             |
| **Lucide React**    | Interface icons                            |
| **Canvas Confetti** | Download celebration effects               |
| **QR Code**         | QR generation and card integration         |

---

# 📦 Installation

## Clone Repository

```bash
git clone https://github.com/AmitDas4321/Indian-Card-Generator.git
```

## Enter Project Directory

```bash
cd Indian-Card-Generator
```

## Install Dependencies

```bash
npm install
```

## Start Development Server

```bash
npm run dev
```

Open the application:

```text
http://localhost:3000
```

---

# 🚀 Production Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

# 📜 Available Scripts

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Starts the Vite development server |
| `npm run build`   | Creates the production build       |
| `npm run preview` | Previews the production build      |
| `npm run lint`    | Runs TypeScript type checking      |

---

# 📁 Project Structure

```text
Indian-Card-Generator
│
├── src/
│   │
│   ├── components/
│   │   ├── CardForm.tsx
│   │   ├── CardPreview.tsx
│   │   ├── DownloadButton.tsx
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   ├── PhotoUploader.tsx
│   │   └── QRScanner.tsx
│   │
│   ├── utils/
│   │   ├── cardRenderer.ts
│   │   ├── confetti.ts
│   │   ├── qr.ts
│   │   └── validation.ts
│   │
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── types.ts
│
├── public/
│   └── ...
│
├── assets/
│   ├── banner.png
│   ├── card-preview.png
│   └── ...
│
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

> Adjust the structure above if your actual source files have different names.

---

# 🧩 Card Rendering Engine

The main card rendering logic is handled by the Canvas renderer:

```text
src/utils/cardRenderer.ts
```

The renderer is responsible for combining:

* Background
* Indian-inspired theme
* Decorative elements
* Photograph
* User information
* QR code
* Borders
* Typography
* Watermarks
* Card layout

The final Canvas resolution is:

```text
1600 × 1000 px
```

---

# 🔳 QR Code

The card can include a QR code containing selected card information or other non-sensitive content configured by the application.

Example flow:

```text
Card Information
       ↓
QR Generator
       ↓
QR Code
       ↓
Canvas
       ↓
Final Card
```

The QR code is intended as a convenient machine-readable element and **does not make the generated card an official identity document**.

---

# 📱 Responsive Design

Indian Card Generator is designed for multiple screen sizes.

```text
📱 Mobile
   ↓
📲 Tablet
   ↓
💻 Laptop
   ↓
🖥️ Desktop
   ↓
🖥️ Ultra-wide
```

The UI adapts to the available screen while the exported card maintains its high-resolution Canvas dimensions.

---

# 🎯 Use Cases

Indian Card Generator can be useful for:

* 🎉 Events
* 🏫 Educational projects
* 👥 Organizations
* 🏢 Internal organization identification
* 🎭 Cultural programs
* 🇮🇳 Independence Day activities
* 🇮🇳 Republic Day activities
* 🎨 Creative projects
* 📸 Personal novelty cards
* 🧪 UI / Canvas demonstration projects

**Do not present generated cards as government-issued identification.**

---

# 🌍 Browser Support

| Browser          | Support |
| ---------------- | :-----: |
| Chrome           |    ✅    |
| Microsoft Edge   |    ✅    |
| Firefox          |    ✅    |
| Safari           |    ✅    |
| Brave            |    ✅    |
| Opera            |    ✅    |
| Android Browsers |    ✅    |
| iOS Browsers     |    ✅    |

---

# 🚀 Deployment

Because Indian Card Generator is primarily a client-side React/Vite application, it can be deployed on a wide range of hosting platforms.

Possible deployment options include:

* Vercel
* Netlify
* Cloudflare Pages
* GitHub Pages
* Static Hosting
* VPS
* Nginx
* Docker

---

# 👨‍💻 Author

<p align="center">
  <a href="https://github.com/AmitDas4321">
    <img src="https://github.com/AmitDas4321.png" width="140" alt="Amit Das">
  </a>
</p>

<p align="center">
  <b>Amit Das</b><br>
  Full Stack Developer
</p>

<p align="center">
  <a href="https://github.com/AmitDas4321">
    <img src="https://img.shields.io/badge/GitHub-AmitDas4321-181717?style=for-the-badge&logo=github">
  </a>
</p>

---

# 🌐 BlueOrbit Devs

Developed and maintained with ❤️ by **BlueOrbit Devs**.

<p align="center">
  <a href="https://www.blueorbitdevs.org">
    <img src="https://img.shields.io/badge/BlueOrbit%20Devs-Website-0B1224?style=for-the-badge">
  </a>
</p>

<p align="center">
  📧 blueorbitdevs@gmail.com
</p>

---

# ⭐ Support

If you like this project, consider giving the repository a ⭐ on GitHub.

Your support helps motivate the development of more open-source tools and creative web experiences.

<p align="center">

⭐ **Star the repository if you find it useful!**

</p>

---

# 📜 License

This project is licensed under the **MIT License**.

See the [`LICENSE`](LICENSE) file for more information.

---

<p align="center">

### 🇮🇳

*"Create with pride. Share with creativity. Celebrate India."*

</p>

---

<p align="center">
  <b>Made with ❤️ for India by <a href="https://amitdas.site">Amit Das</a></b><br>
  <b>BlueOrbit Devs</b>
</p>