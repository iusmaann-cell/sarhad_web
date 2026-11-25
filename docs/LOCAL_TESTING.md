# Test Sarhad on your own computer

This guide runs the **website** and the **back office** on your Mac, with a sample menu, two branches, delivery areas and test accounts already filled in. You can place a real order on the website and watch it arrive on the back office orders board.

Nothing here touches the internet or real money. Everything runs only on your computer, and you can wipe it and start again at any time.

The steps are written for a **Mac** (Apple chip or Intel). Windows notes are at the end.

**Time needed:** about 30 to 45 minutes the first time (mostly downloads). After that, starting everything takes about 2 minutes.

---

## What you get

| What              | Where                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| Customer website  | http://localhost:3000 (Arabic) and http://localhost:3000/en (English) |
| Back office       | http://localhost:3001                                                 |
| Test emails inbox | http://localhost:54324 (sign-up and password reset emails land here)  |
| Database viewer   | http://localhost:54323 (Supabase Studio, optional)                    |

**Sample data**

- **2 branches**: _Sarhad Chicken - Kuwait City_ and _Sarhad Chicken - Salmiya_. Both are set to "open all day" so you can test at any hour. Set real hours later in the back office under **Branches**.
- **Delivery areas**:
  - City **Capital**: Sharq, Qibla, Dasman, Mirqab, Bneid Al-Gar. Orders go to the **Kuwait City** branch. Fee KWD 0.500, minimum order KWD 3.000.
  - City **Hawalli**: Hawalli, Salmiya, Jabriya, Rumaithiya, Salwa. Orders go to the **Salmiya** branch. Fee KWD 0.750, minimum order KWD 4.000.
- **Menu** (18 sample dishes in 6 categories): Fried Chicken, Meals, Sandwiches, Strips and Wings, Sides, Drinks. Many dishes have add-ons (pieces, flavour, drink choice, extras). These are samples: change or delete them in the back office.
- **Branch differences** (to show how per-branch control works): at the **Salmiya** branch, _Cheese Fries_ is sold out and _Hot Wings_ costs KWD 1.650 instead of KWD 1.500.
- **Promo codes**: `WELCOME10` (10% off orders over KWD 2.000, up to KWD 1.500 off) and `FREEDELIVERY` (free delivery on orders over KWD 3.000).
- **Test payment**: a pretend online payment option, so you can try "pay online" with no real money.

**Test accounts** (the password for all of them is `Sarhad1234`)

| Email                  | Who                                 | Use it on   |
| ---------------------- | ----------------------------------- | ----------- |
| `customer@sarhad.test` | A customer                          | Website     |
| `owner@sarhad.test`    | Owner: sees and controls everything | Back office |
| `manager@sarhad.test`  | Manager of the Kuwait City branch   | Back office |
| `salmiya@sarhad.test`  | Manager of the Salmiya branch       | Back office |
| `kitchen@sarhad.test`  | Kitchen staff, Kuwait City branch   | Back office |

---

## Part 1. Install the tools (only once)

You type commands in the **Terminal** app. Open it with **Cmd + Space**, type `Terminal`, press **Enter**.

To run a command: copy the grey box, paste it into Terminal (**Cmd + V**), press **Enter**, and wait until Terminal shows the prompt again (a line ending in `%`).

### 1.1 Apple developer tools (includes git)

```bash
xcode-select --install
```

A window opens. Click **Install** and wait for it to finish. If Terminal says _"already installed"_, that is fine, go on.

### 1.2 Homebrew (installs the other tools)

Check if you already have it:

```bash
brew --version
```

If you see a version number, skip to 1.3. If you see _"command not found"_, install it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

It asks for your Mac password (typing shows nothing, that is normal). When it finishes, it prints **"Next steps"** with two or three commands starting with `echo` and `eval`. Copy and run those too, then close Terminal and open it again.

### 1.3 Node.js 22 and pnpm

```bash
brew install node@22
brew link --overwrite --force node@22
npm install -g pnpm@10
```

Check both work:

```bash
node --version
pnpm --version
```

You should see `v22.something` and `10.something`.

### 1.4 Docker Desktop

The database runs inside Docker.

1. Download **Docker Desktop for Mac** from https://www.docker.com/products/docker-desktop/ . Pick **Apple Silicon** if your Mac has an M1, M2, M3 or M4 chip (Apple menu > About This Mac shows the chip), otherwise **Intel**.
2. Open the downloaded file, drag Docker to Applications, then open **Docker** from Applications.
3. Accept the terms. You can skip signing in.
4. Wait until the whale icon in the top menu bar stops animating. Docker must be **running** every time you test.

Docker Desktop is free for personal use and small businesses.

---

## Part 2. Get the code (only once)

This puts the project in a folder called `sarhad_web` inside your `Projects` folder.

```bash
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/iusmaann-cell/sarhad_web.git
cd sarhad_web
```

If git asks you to sign in to GitHub, use your GitHub username, and as the password a **personal access token** (GitHub > Settings > Developer settings > Personal access tokens). Or install **GitHub Desktop**, sign in, and use **File > Clone repository** to clone into `~/Projects`.

**Until the latest changes are merged into `main`**, switch to the branch that has the new design and the sample menu:

```bash
git checkout claude/project-thread-o16am4
```

(After the pull requests are merged, skip this. `main` has everything.)

Now install the project's own packages (takes 1 to 3 minutes):

```bash
pnpm install
```

---

## Part 3. Start the database (first time)

Make sure **Docker is running** (whale icon in the menu bar), then:

```bash
pnpm db:start
```

The first time, this downloads several Supabase images (a few GB), so it can take **5 to 15 minutes**. It then creates all the tables and loads the sample data.

When it finishes, it prints a list of addresses and keys. You need two of them:

- **Publishable key** (starts with `sb_publishable_`). Older versions call it **anon key**.
- **Secret key** (starts with `sb_secret_`). Older versions call it **service_role key**.

You can show this list again at any time with:

```bash
pnpm exec supabase status
```

---

## Part 4. Connect the website and back office to the database (only once)

Create the settings files from the example:

```bash
cp .env.example apps/web/.env.local
cp .env.example apps/admin/.env.local
```

### 4.1 Website settings

Open the file in TextEdit:

```bash
open -e apps/web/.env.local
```

Change these lines (paste your own keys from Part 3):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...your key...
```

Find these two lines, remove the `# ` at the start, and paste the secret key:

```
SUPABASE_SECRET_KEY=sb_secret_...your key...
ALLOW_TEST_GATEWAY=true
```

The secret key is only needed for the "Test payment" option. Never share it and never put it in the mobile app. (On your computer it is a local test key, so it is harmless here.)

Optionally fill in the contact details shown when a customer's area is not listed:

```
NEXT_PUBLIC_CONTACT_PHONE=+965 2200 0000
NEXT_PUBLIC_CONTACT_WHATSAPP=+965 5000 0000
NEXT_PUBLIC_CONTACT_EMAIL=hello@example.com
```

Save (**Cmd + S**) and close TextEdit.

### 4.2 Back office settings

```bash
open -e apps/admin/.env.local
```

Change only these two lines, then save and close:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...your key...
```

---

## Part 5. Start the website and the back office

You need **two Terminal windows** (in Terminal: **Cmd + N** opens a new one). Both stay open while you test.

**Window 1, the website:**

```bash
cd ~/Projects/sarhad_web
pnpm dev:web
```

**Window 2, the back office:**

```bash
cd ~/Projects/sarhad_web
pnpm dev:admin
```

Each one is ready when it shows `Ready` and a `localhost` address. The very first page you open can take 10 to 20 seconds to appear while it is prepared. After that pages are fast.

---

## Part 6. Test a full order

Use **Chrome** or **Safari**. Tip: put the website and the back office side by side.

### 6.1 Order on the website (as a customer)

1. Open **http://localhost:3000/en** (or http://localhost:3000 for Arabic).
2. A popup asks **"How do you want your order?"**. Click **Delivery**.
3. **City**: choose **Hawalli**. **Area**: choose **Salmiya**. It shows the fee (KWD 0.750), time and minimum order. Click **Continue to menu**.
4. The menu shows **"Delivery to Salmiya, Hawalli"**. Notice _Cheese Fries_ is **Sold out** and _Hot Wings_ is **KWD 1.650**: that is the Salmiya branch's own setting.
5. Click **Add** on **Sarhad Meal**. Pick a flavour and a drink, then **Add to cart**.
6. Add a **Family Bucket** too (the minimum order for Salmiya is KWD 4.000).
7. Open the cart (bag icon at the top) and click **Checkout**.
8. You are asked to sign in. Use `customer@sarhad.test` / `Sarhad1234`. (Or click **Sign up** to make a new account: the confirmation email arrives at http://localhost:54324.)
9. At checkout fill in **Block** (e.g. `10`), **Street** (e.g. `Salem Al-Mubarak`) and **House or building** (e.g. `5`). Name and mobile (e.g. `50000000`) if empty.
10. Type `WELCOME10` in **Promo code** and click **Apply**. The 10% discount appears.
11. Payment: **Cash on delivery or at pickup**.
12. Click **Place order**. You see **"Thank you! Your order has been sent to the branch"** with an order number (for example #1010) and a status tracker.

Keep this page open: it updates by itself every 15 seconds.

### 6.2 See it in the back office (as the Salmiya manager)

1. Open **http://localhost:3001**. The back office starts in Arabic: click the **language** button (top) to switch to English if you like.
2. Sign in with `salmiya@sarhad.test` / `Sarhad1234`.
3. Click **Orders** in the left menu. Your order is in the **New** column with the items, address, total and **Cash to collect**. Click **Turn on sound alerts** to hear a chime for new orders.
4. Click **Accept**. On the customer's order page the tracker moves to **Accepted** (within 15 seconds).
5. Click **Start preparing**, then **Mark ready**, then **Out for delivery**, then **Complete**. Watch the customer page follow each step.
6. Click the order number to open the full order page (status history, map link, **Print** for a kitchen ticket).

**Why the Salmiya manager?** The customer chose Salmiya, which belongs to the Salmiya branch's delivery zone, so the order went there automatically. If you sign in as `manager@sarhad.test` (Kuwait City), you will **not** see it. `owner@sarhad.test` sees all branches.

---

## Part 7. More things to try

**Pickup order**
On the website click the delivery chip at the top (**"Delivery to Salmiya"**) to change. Choose **Pickup**, pick **Kuwait City**, order, and check the board as `manager@sarhad.test` or `kitchen@sarhad.test`.

**Area not listed**
In the popup choose Delivery, then **"My area isn't listed"**. You see the restaurant's call, WhatsApp and email (from Part 4.1) and **Pick up instead**.

**Online payment (pretend)**
At checkout choose **Test payment (no real money)** and place the order. A test payment page opens: approve it and the order is marked **Paid online** and reaches the board. Decline it and the order stays off the board, with a **Pay now** button for the customer to retry.

**Cancel an order**
On the board click **Cancel order**, pick a reason. The customer sees the reason on their order page. A customer can also cancel by themselves before the branch accepts.

**Pause a branch**
On the board click **Pause orders**. Customers can no longer order from that branch. Click again to resume.

**Add your own dish** (as `owner@sarhad.test`)

1. Back office > **Menu** > new item. Fill in the Arabic and English names, price (KWD), category, optional photo and add-ons (for example a "Size" group, choose 1, required). Save.
2. Refresh the website menu: the new dish is there.

**Sold out in one branch**
Back office > **Menu** > **Availability**, choose a branch, switch a dish off. It shows **Sold out** only for that branch.

**Delivery zones and areas**
Back office > **Delivery zones**: open a zone to redraw it on the map, change the fee, minimum order, time, and the list of cities and areas customers can pick.

**Promo codes**
Back office > **Promo codes**: create a code (percent, fixed amount or free delivery) and try it at checkout.

**Staff**
Back office > **Staff** (as owner): give another email a role, e.g. staff in one branch.

**Dashboard and history**
Back office > **Dashboard** for today's orders and sales, **Orders > Order history** to search past orders.

**Arabic**
Switch the website and the back office to Arabic and check everything reads right to left.

---

## Part 8. Stopping and starting again

**Stop:** in each Terminal window press **Ctrl + C**. Then stop the database:

```bash
cd ~/Projects/sarhad_web
pnpm db:stop
```

You can also just quit Docker. Your test orders are kept.

**Start again another day:**

1. Open **Docker** and wait for the whale icon.
2. In Terminal:
   ```bash
   cd ~/Projects/sarhad_web
   pnpm db:start
   ```
3. Window 1: `cd ~/Projects/sarhad_web` then `pnpm dev:web`
4. Window 2: `cd ~/Projects/sarhad_web` then `pnpm dev:admin`

**Get the latest version** (after new changes are merged):

```bash
cd ~/Projects/sarhad_web
git checkout main
git pull
pnpm install
pnpm db:reset
```

**Wipe everything and go back to the sample data** (deletes all test orders, dishes you added, and accounts you created):

```bash
pnpm db:reset
```

---

## Troubleshooting

| You see                                                                    | Do this                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command not found: pnpm` or `node`                                        | Close Terminal, open it again. If it still fails, repeat Part 1.3.                                                                                                                                                         |
| `Cannot connect to the Docker daemon` or `docker: not running`             | Open Docker Desktop and wait for the whale icon to stop animating, then run the command again.                                                                                                                             |
| `port 54322 is already allocated` (or similar)                             | Another Supabase project is running. Run `pnpm exec supabase stop --all`, then `pnpm db:start`.                                                                                                                            |
| `Port 3000 is in use` / `3001 is in use`                                   | An old window is still running. Close the other Terminal windows (or restart the Mac) and start again.                                                                                                                     |
| The website shows an error about Supabase, an empty menu, or sign-in fails | The keys in `.env.local` are wrong or missing. Compare them with `pnpm exec supabase status` (Part 4). After changing a `.env.local` file, stop the app with Ctrl + C and start it again.                                  |
| "Test payment" is not offered at checkout                                  | Check `SUPABASE_SECRET_KEY` and `ALLOW_TEST_GATEWAY=true` in `apps/web/.env.local` (no `#` at the start), then restart `pnpm dev:web`.                                                                                     |
| "The branch is closed" at checkout                                         | Someone changed the opening hours in **Branches**, or **Pause orders** is on. Fix it in the back office, or run `pnpm db:reset`.                                                                                           |
| The order does not show on the board                                       | Make sure you are signed in as the right branch (Salmiya areas go to `salmiya@sarhad.test`, Capital areas to `manager@sarhad.test`), or use `owner@sarhad.test`. Online-paid orders appear only after payment is approved. |
| Maps are blank                                                             | The free map tiles need an internet connection. Everything else still works.                                                                                                                                               |
| `git checkout` says the branch does not exist                              | It was merged and deleted: use `git checkout main` and `git pull`.                                                                                                                                                         |

---

## Optional: the mobile app

With the database and website running, in a third Terminal window:

```bash
cd ~/Projects/sarhad_web
cp apps/mobile/.env.example apps/mobile/.env
open -e apps/mobile/.env      # paste the same publishable key, save
pnpm dev:mobile
```

Press **w** to open the app in your browser. To use your phone, install **Expo Go** from the App Store or Google Play, connect the phone to the same Wi-Fi, replace `localhost` in `apps/mobile/.env` with your Mac's IP address (System Settings > Wi-Fi > Details), restart, and scan the QR code.

---

## Windows notes

The same steps work on Windows 10/11 with these changes:

- Install **Git for Windows** (https://git-scm.com), **Node.js 22 LTS** (https://nodejs.org), and **Docker Desktop for Windows** (it will turn on WSL 2 for you). Then in **PowerShell**: `npm install -g pnpm@10`.
- Use **PowerShell** instead of Terminal. Use `cd $HOME\Projects` instead of `cd ~/Projects`.
- Instead of `cp`, use `copy .env.example apps\web\.env.local` (and the same for admin).
- Instead of `open -e`, use `notepad apps\web\.env.local`.
