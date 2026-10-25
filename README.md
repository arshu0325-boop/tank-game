# 🚀 Tank Game - Setup & Play Guide

Welcome to the Tank Game repository! It's a turn based tactical artillery combat game, built in TypeScript, Phaser 3 and Vite.

Just follow the steps below to get the game up and running on a completely fresh laptop.

---

## 🛠️ Step 1: Install Prerequisites

Before you go cloning or running the project your fresh laptop will need a JS runtime environment.

1. Install Node.js (which comes with npm):
* Download and install the LTS (Long Term Support) version of Node.js.
* Verify the installation by opening your terminal (PowerShell, Command Prompt, or Terminal) and running:
```bash
node -v
npm -v

```




2. Install Git (optional if you're cloning via repository):
* Download and install Git (https://git-scm.com/)



---

## 📦 Step 2: Clone or Open the Project

1. Open up your terminal and clone the repository (or just open the project folder if you already have the source files downloaded):
```bash
git clone https://github.com/RajatGarud/tank-game.git
cd tank-game

```


2. Open the folder in your code editor (e.g. Visual Studio Code):
```bash
code .

```



---

## 📥 Step 3: Install Dependencies

As node_modules isn't under version control you'll need to install the project dependencies as listed in package.json.

Run the following command in your project terminal:

```bash
npm install

```

---

## 🚀 Step 4: Run the Development Server

Once the installation is complete, start the local development server:

```bash
npm run dev

```

* Vite will spin up a local dev server (typically at http://localhost:5173 or similar local port).
* Control-click or copy and paste that URL into your web browser to play the game!

---

## 🎮 Game Controls Reference

* Aiming: move your mouse cursor across the battlefield to adjust the cannon angle.
* Firing: Click anywhere in the arena or press the Spacebar to fire. Hold to charge up extra power!
* Power adjustment: press the Up / Down arrow keys to adjust your shot power.
* **Tank Movement:**
* Player 1: Use A (Left) and D (Right) keys.
* Player 2: Use the Left and Right Arrow keys.
*(Note: Movement uses a finite amount of fuel based on the actual distance travelled).*


* Weapon selection: Press 1 (Shell), 2 (Missile) or 3 (Boomerang) or click on the weapon icons at the bottom of the HUD.