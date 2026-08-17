# Blood Connect Now

Build a mobile app: Act as a Senior Full-Stack Mobile & Web App Developer. I am building a life-saving blood donation and emergency matching application called "BLOODCONNECT".

I have attached/provided my complete PRD, UI/UX designs (frontend images), and technical documentation. Your job is to analyze all attached documents, images, and the feature requirements below to build a production-ready mobile application.

---

### 🚀 APP OVERVIEW & CORE OBJECTIVE

BLOODCONNECT is a real-time, location-based emergency blood donation platform connecting patients in urgent need with nearby eligible donors.

---

### 🔑 KEY FEATURES & FUNCTIONALITIES

1. User Onboarding & Profiles:

   - User Registration & Authentication (Mobile OTP / Email).

   - Profile Details: Full Name, Phone Number, Permanent Address, Current Address.

   - Medical Details: Blood Group (A+, A-, B+, B-, O+, O-, AB+, AB-), Last Blood Donation Date (to calculate current eligibility).

2. Real-Time Geolocation & Matching:

   - Dynamic user location tracking (Current Address / GPS).

   - Radius-based donor matching (e.g., showing donors within 5 km, 10 km, etc.).

   - Visual distance indicator showing how far a potential donor is from the patient/hospital.

3. Emergency SOS Request Trigger:

   - One-tap "SOS Emergency" button for patients/requesters.

   - Input Fields: Required Blood Group, Number of Units needed, Urgency Status (e.g., Critical, Urgent, Scheduled/Future Time), Hospital Location.

   - Push Notification System: Instant notification broadcasted to all eligible, active donors in the same city and within the specified radius.

4. Donor Response System:

   - Accept / Decline action buttons on incoming SOS alerts.

   - Donor Status Update (e.g., "Arriving in 30 mins", "Available after 2 hours").

5. Real-Time Communication:

   - Direct Phone Call integration using the registered mobile number.

   - In-app Chat/Messaging between Patient/Requester and Donor to share updates, patient condition, and hospital room details.

---

### 🎨 UI/UX & ARCHITECTURE INSTRUCTIONS

- Refer strictly to the provided UI images for layout, color scheme, typography, and component placement.

- Refer to the attached PRD for exact data schemas, database architecture, API endpoints, and state management rules.

- Ensure smooth handling of edge cases (e.g., no donors nearby, donor ineligible due to recent donation within 90 days, network lag during SOS).

---

### 🛠 NEXT STEPS

1. Review all attached PRD documents and UI design files.

2. Generate the complete project structure, database models, frontend UI screens, and real-time notification backend logic.

3. Start by asking me any clarifying questions if there are discrepancies between the UI images and the PRD.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bloodconnect27.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ea8f2845-f434-482a-87a8-3af73e612221).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
