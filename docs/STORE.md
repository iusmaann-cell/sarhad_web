# App Store and Google Play release

Everything in this file needs the restaurant's own developer accounts, so it is done by the owner (or someone they invite). The code side is ready: `apps/mobile/app.json` has the bundle id `kw.sarhad.app`, version `1.0.0`, and `apps/mobile/eas.json` has the build profiles.

## Accounts **(owner)**

| Store                   | Cost         | Notes                                                                                                                                 |
| ----------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Apple Developer Program | yearly fee   | Enrol as an **organisation** (needs a D-U-N-S number for the company) so the seller name shows "Sarhad", not a person.                |
| Google Play Console     | one-time fee | Organisation account. New personal accounts must run a closed test with testers for two weeks first; organisation accounts skip that. |
| Expo (EAS)              | free plan    | Builds the iOS and Android binaries in the cloud; the free plan's monthly builds are enough.                                          |

## Build and submit

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init                 # links the project, writes the project id into app.json
# Production values, set once in the EAS dashboard or with:
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <publishable key>
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SITE_URL --value https://sarhad.com.kw

npx eas-cli build --profile preview --platform android     # an APK to try on a phone first
npx eas-cli build --profile production --platform all
npx eas-cli submit --platform ios
npx eas-cli submit --platform android
```

Before the first submission, test on a real iPhone and Android phone (so far the app has been tested through its web build only): sign up, password reset email link, ordering with "Use my location", paying online, the "Back to the app" link after payment, Arabic right-to-left layout, and deleting the account.

## Listing text

**App name:** Sarhad | سرحد
**Subtitle (iOS, 30 characters):** Order online in Kuwait / اطلب أونلاين في الكويت
**Category:** Food & Drink
**Age rating:** 4+ / Everyone

**Short description (Google Play, 80 characters)**

- EN: Order Sarhad for delivery or pickup across Kuwait. Pay cash or online.
- AR: اطلب من سرحد توصيل أو استلام في الكويت. ادفع نقداً أو أونلاين.

**Full description (EN)**

> Order your Sarhad favourites in a few taps.
>
> - Browse the full menu with photos and prices.
> - Delivery or pickup from your nearest branch.
> - Check if we deliver to you, see the delivery fee and minimum order.
> - Save your addresses for faster checkout.
> - Pay cash on delivery, or online with KNET or card where available.
> - Use promo codes for discounts and free delivery.
> - Follow your order from the kitchen to your door.
>
> Available in Arabic and English.

**Full description (AR)**

> اطلب أطباقك المفضلة من سرحد بخطوات قليلة.
>
> - تصفّح القائمة كاملة مع الصور والأسعار.
> - توصيل أو استلام من أقرب فرع.
> - تحقّق من التوصيل إلى منطقتك، واعرف رسوم التوصيل والحد الأدنى للطلب.
> - احفظ عناوينك لطلب أسرع.
> - ادفع نقداً عند الاستلام، أو أونلاين بالكي نت أو البطاقة حيث يتوفر.
> - استخدم أكواد الخصم للتخفيضات والتوصيل المجاني.
> - تابع طلبك من المطبخ حتى باب بيتك.
>
> متوفر بالعربية والإنجليزية.

**Keywords (iOS, 100 characters):** sarhad,restaurant,kuwait,food,delivery,pickup,order,سرحد,مطعم,الكويت,توصيل,طلب

**URLs**

- Privacy policy: `https://sarhad.com.kw/en/privacy`
- Support / marketing: `https://sarhad.com.kw`
- Account deletion (Google Play requires a web link): `https://sarhad.com.kw/en/account` (sign in, then _Delete my account_). Customers can also delete from the app: **Account > Delete my account**.

**Screenshots:** iPhone 6.9" and 6.5", Android phone. Take them from the production build with the real menu: home, menu, item, cart, checkout, order tracking, in Arabic and English.

## Privacy answers

Apple App Privacy ("nutrition label") and Google Play Data safety, based on what the app actually does:

| Data             | Collected                                                 | Linked to the user | Used for                               | Shared                             |
| ---------------- | --------------------------------------------------------- | ------------------ | -------------------------------------- | ---------------------------------- |
| Name             | Yes                                                       | Yes                | App functionality (orders)             | No (only processors acting for us) |
| Email address    | Yes                                                       | Yes                | Account, sign-in, password reset       | No                                 |
| Phone number     | Yes                                                       | Yes                | Contacting the customer about an order | No                                 |
| Physical address | Yes                                                       | Yes                | Delivery                               | No                                 |
| Precise location | Yes, only when the user taps "Use my location"            | Yes                | Delivery pin                           | No                                 |
| Purchase history | Yes                                                       | Yes                | Order history                          | No                                 |
| Payment info     | No (entered on the gateway's page, never seen by the app) |                    |                                        |                                    |

- No tracking, no advertising, no analytics SDKs.
- Data is encrypted in transit (HTTPS).
- Users can delete their account in the app and on the website.
- Export compliance: the app uses only standard HTTPS encryption (`ITSAppUsesNonExemptEncryption = false` is set).

## App review notes

Apple and Google need a working login to review the app. Create a normal customer account for them (for example `review@sarhad.com.kw`), give it a saved address inside a delivery zone, and put the email and password in the review notes. Mention that payment is cash on delivery, or online through the payment provider's page.
