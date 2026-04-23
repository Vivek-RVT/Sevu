import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./src/schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function seed() {
  console.log("🌱 Seeding database...");

  // ── 1. Businesses ────────────────────────────────────────────
  const [biz1, biz2, biz3] = await db.insert(schema.businessesTable).values([
    {
      name: "Raj Hair Studio",
      category: "Salon / Barbershop",
      phone: "9876543210",
      address: "Shop 12, MG Road, Pune",
      reviewLink: "https://g.page/r/rajhairstudio",
      defaultReminderMessage: "Hi [Name], your [ServiceType] service is due. Visit again 😊",
      defaultReviewMessage: "Thank you for your visit 🙏 Please rate our service ⭐ [Review Link]",
    },
    {
      name: "FitZone Gym",
      category: "Gym / Fitness",
      phone: "9123456789",
      address: "2nd Floor, Laxmi Plaza, Andheri West, Mumbai",
      reviewLink: "https://g.page/r/fitzonegym",
      defaultReminderMessage: "Hi [Name], your [ServiceType] session is due. Come back stronger 💪",
      defaultReviewMessage: "Thanks for working out with us! Rate us ⭐ [Review Link]",
    },
    {
      name: "Sharma Electricals",
      category: "Electrician",
      phone: "9988776655",
      address: "Near Bus Stand, Sector 22, Chandigarh",
      reviewLink: "https://g.page/r/sharmaelectricals",
      defaultReminderMessage: "Hi [Name], annual electrical check is due. Book now 🔧",
      defaultReviewMessage: "Thank you for choosing us! Please leave a review ⭐ [Review Link]",
    },
  ]).returning();

  console.log("✓ Businesses inserted");

  // ── 2. Users ──────────────────────────────────────────────────
  await db.insert(schema.usersTable).values([
    {
      phone: "9876543210",
      passwordHash: "$2b$10$demohashedpassword1111111111111111111111111111111111111",
      phoneVerified: true,
      businessId: biz1.id,
    },
    {
      phone: "9123456789",
      passwordHash: "$2b$10$demohashedpassword2222222222222222222222222222222222222",
      phoneVerified: true,
      businessId: biz2.id,
    },
    {
      phone: "9988776655",
      passwordHash: "$2b$10$demohashedpassword3333333333333333333333333333333333333",
      phoneVerified: true,
      businessId: biz3.id,
    },
  ]);

  console.log("✓ Users inserted");

  // ── 3. Customers ──────────────────────────────────────────────
  const salonCustomers = await db.insert(schema.customersTable).values([
    {
      businessId: biz1.id,
      name: "Aarav Mehta",
      phone: "9000001111",
      email: "aarav.mehta@gmail.com",
      gender: "male",
      birthday: "1992-04-15",
      serviceType: "Haircut",
      lastServiceDate: "2026-03-10",
      nextServiceDate: "2026-04-10",
      totalSpent: 1800,
      outstandingBalance: 0,
      notes: "Prefers fade cut",
    },
    {
      businessId: biz1.id,
      name: "Priya Sharma",
      phone: "9000002222",
      email: "priya.sharma@gmail.com",
      gender: "female",
      birthday: "1995-08-22",
      serviceType: "Color, Blowdry",
      lastServiceDate: "2026-03-20",
      nextServiceDate: "2026-04-25",
      totalSpent: 4500,
      outstandingBalance: 500,
      notes: "Allergic to ammonia-based colors",
    },
    {
      businessId: biz1.id,
      name: "Rohan Desai",
      phone: "9000003333",
      gender: "male",
      serviceType: "Shave",
      lastServiceDate: "2026-03-28",
      nextServiceDate: "2026-04-14",
      totalSpent: 900,
      outstandingBalance: 0,
    },
    {
      businessId: biz1.id,
      name: "Neha Kapoor",
      phone: "9000004444",
      email: "neha.kapoor@yahoo.com",
      gender: "female",
      birthday: "1990-12-05",
      serviceType: "Facial, Haircut",
      lastServiceDate: "2026-02-15",
      nextServiceDate: "2026-04-15",
      totalSpent: 6200,
      outstandingBalance: 0,
      notes: "VIP customer — prefers appointment on weekends",
      tags: "vip",
    },
    {
      businessId: biz1.id,
      name: "Vikas Joshi",
      phone: "9000005555",
      gender: "male",
      serviceType: "Haircut",
      lastServiceDate: "2026-03-01",
      nextServiceDate: "2026-04-01",
      totalSpent: 1200,
      outstandingBalance: 200,
    },
  ]).returning();

  const gymCustomers = await db.insert(schema.customersTable).values([
    {
      businessId: biz2.id,
      name: "Kabir Singh",
      phone: "9100001111",
      email: "kabir.singh@gmail.com",
      gender: "male",
      birthday: "1998-06-10",
      serviceType: "Gym Membership",
      lastServiceDate: "2026-03-01",
      nextServiceDate: "2026-04-01",
      totalSpent: 8000,
      outstandingBalance: 0,
      notes: "Wants weight training focus",
      tags: "regular",
    },
    {
      businessId: biz2.id,
      name: "Anjali Verma",
      phone: "9100002222",
      email: "anjali.verma@gmail.com",
      gender: "female",
      birthday: "2000-02-28",
      serviceType: "Zumba Classes",
      lastServiceDate: "2026-03-15",
      nextServiceDate: "2026-04-15",
      totalSpent: 5000,
      outstandingBalance: 0,
    },
    {
      businessId: biz2.id,
      name: "Manish Gupta",
      phone: "9100003333",
      gender: "male",
      serviceType: "Personal Training",
      lastServiceDate: "2026-03-25",
      nextServiceDate: "2026-04-08",
      totalSpent: 12000,
      outstandingBalance: 3000,
      notes: "Training for marathon",
    },
  ]).returning();

  const elecCustomers = await db.insert(schema.customersTable).values([
    {
      businessId: biz3.id,
      name: "Suresh Patel",
      phone: "9200001111",
      email: "suresh.patel@gmail.com",
      serviceType: "Wiring",
      lastServiceDate: "2026-03-05",
      nextServiceDate: "2026-09-05",
      totalSpent: 15000,
      outstandingBalance: 0,
      notes: "New flat wiring project done",
    },
    {
      businessId: biz3.id,
      name: "Meena Agarwal",
      phone: "9200002222",
      serviceType: "CCTV Installation",
      lastServiceDate: "2026-03-18",
      nextServiceDate: "2026-03-25",
      totalSpent: 8500,
      outstandingBalance: 2000,
    },
    {
      businessId: biz3.id,
      name: "Harish Kumar",
      phone: "9200003333",
      email: "harish.kumar@gmail.com",
      serviceType: "Panel Upgrade",
      lastServiceDate: "2026-02-20",
      nextServiceDate: "2026-08-20",
      totalSpent: 22000,
      outstandingBalance: 0,
    },
  ]).returning();

  console.log("✓ Customers inserted");

  // ── 4. Service Logs ───────────────────────────────────────────
  await db.insert(schema.serviceLogsTable).values([
    // Salon logs
    {
      businessId: biz1.id, customerId: salonCustomers[0].id, customerName: "Aarav Mehta",
      service: "Haircut", amount: 350, paidAmount: 350, paymentStatus: "paid",
      serviceDate: new Date("2026-03-10"),
    },
    {
      businessId: biz1.id, customerId: salonCustomers[0].id, customerName: "Aarav Mehta",
      service: "Haircut", amount: 350, paidAmount: 350, paymentStatus: "paid",
      serviceDate: new Date("2026-02-08"),
    },
    {
      businessId: biz1.id, customerId: salonCustomers[1].id, customerName: "Priya Sharma",
      service: "Color, Blowdry", amount: 2200, paidAmount: 1700, paymentStatus: "partial",
      serviceDate: new Date("2026-03-20"),
      note: "Partial payment — balance pending",
    },
    {
      businessId: biz1.id, customerId: salonCustomers[3].id, customerName: "Neha Kapoor",
      service: "Facial, Haircut", amount: 1800, paidAmount: 1800, paymentStatus: "paid",
      serviceDate: new Date("2026-02-15"),
    },
    {
      businessId: biz1.id, customerId: salonCustomers[4].id, customerName: "Vikas Joshi",
      service: "Haircut", amount: 350, paidAmount: 150, paymentStatus: "partial",
      serviceDate: new Date("2026-03-01"),
    },
    // Gym logs
    {
      businessId: biz2.id, customerId: gymCustomers[0].id, customerName: "Kabir Singh",
      service: "Monthly Membership", amount: 2000, paidAmount: 2000, paymentStatus: "paid",
      serviceDate: new Date("2026-03-01"),
    },
    {
      businessId: biz2.id, customerId: gymCustomers[1].id, customerName: "Anjali Verma",
      service: "Zumba — Monthly", amount: 1500, paidAmount: 1500, paymentStatus: "paid",
      serviceDate: new Date("2026-03-15"),
    },
    {
      businessId: biz2.id, customerId: gymCustomers[2].id, customerName: "Manish Gupta",
      service: "Personal Training — 8 sessions", amount: 6000, paidAmount: 3000, paymentStatus: "partial",
      serviceDate: new Date("2026-03-25"),
    },
    // Electrician logs
    {
      businessId: biz3.id, customerId: elecCustomers[0].id, customerName: "Suresh Patel",
      service: "Full Flat Wiring", amount: 15000, paidAmount: 15000, paymentStatus: "paid",
      serviceDate: new Date("2026-03-05"),
    },
    {
      businessId: biz3.id, customerId: elecCustomers[1].id, customerName: "Meena Agarwal",
      service: "CCTV — 4 Camera Setup", amount: 8500, paidAmount: 6500, paymentStatus: "partial",
      serviceDate: new Date("2026-03-18"),
      note: "Balance ₹2000 pending",
    },
    {
      businessId: biz3.id, customerId: elecCustomers[2].id, customerName: "Harish Kumar",
      service: "Panel Upgrade + MCB", amount: 22000, paidAmount: 22000, paymentStatus: "paid",
      serviceDate: new Date("2026-02-20"),
    },
  ]);

  console.log("✓ Service logs inserted");

  // ── 5. Profiles (public directory) ───────────────────────────
  const [prof1, prof2, prof3] = await db.insert(schema.profilesTable).values([
    {
      businessId: biz1.id,
      name: "Raj Hair Studio",
      slug: "raj-hair-studio-pune",
      phone: "9876543210",
      service: "Salon / Barbershop",
      city: "Pune",
      address: "Shop 12, MG Road, Pune",
      lat: 18.5204,
      lng: 73.8567,
      description: "Premium salon with 10+ years of experience. Specialising in modern haircuts, color treatments, and bridal makeovers.",
      servicesOffered: "Haircut, Shave, Color, Blowdry, Facial, Bridal Makeup",
      priceRange: "₹200–₹2500",
      isAvailable24x7: false,
      yearsExperience: 10,
      openingHours: "Mon–Sat: 9am–9pm",
      instagram: "rajhairstudiopune",
      whatsapp: "9876543210",
      certifications: "Lakme Academy Certified",
      rating: 4.6,
      totalReviews: 3,
      totalJobs: 520,
      viewCount: 1240,
      callClicks: 85,
      whatsappClicks: 210,
    },
    {
      businessId: biz2.id,
      name: "FitZone Gym",
      slug: "fitzone-gym-mumbai",
      phone: "9123456789",
      service: "Gym / Fitness",
      city: "Mumbai",
      address: "2nd Floor, Laxmi Plaza, Andheri West, Mumbai",
      lat: 19.1364,
      lng: 72.8296,
      description: "State-of-the-art gym with certified trainers, modern equipment, and group fitness classes. Transform your body today!",
      servicesOffered: "Weight Training, Zumba, Yoga, CrossFit, Personal Training",
      priceRange: "₹1500–₹6000/month",
      isAvailable24x7: false,
      yearsExperience: 6,
      openingHours: "Mon–Sun: 5am–11pm",
      instagram: "fitzonemuumbai",
      website: "https://fitzonegym.in",
      whatsapp: "9123456789",
      rating: 4.4,
      totalReviews: 2,
      totalJobs: 320,
      viewCount: 980,
      callClicks: 55,
      whatsappClicks: 140,
    },
    {
      businessId: biz3.id,
      name: "Sharma Electricals",
      slug: "sharma-electricals-chandigarh",
      phone: "9988776655",
      service: "Electrician",
      city: "Chandigarh",
      address: "Near Bus Stand, Sector 22, Chandigarh",
      lat: 30.7333,
      lng: 76.7794,
      description: "Licensed electrician with expertise in residential and commercial wiring, CCTV installation, and panel upgrades. Available for emergency calls.",
      servicesOffered: "Wiring, Panel Upgrades, CCTV, Lighting, Short Circuit Repair",
      priceRange: "₹500–₹50,000",
      isAvailable24x7: true,
      yearsExperience: 15,
      openingHours: "Daily: 8am–8pm (Emergency 24×7)",
      whatsapp: "9988776655",
      certifications: "Licensed Electrical Contractor — Punjab",
      rating: 4.8,
      totalReviews: 2,
      totalJobs: 840,
      viewCount: 620,
      callClicks: 110,
      whatsappClicks: 95,
    },
  ]).returning();

  console.log("✓ Profiles inserted");

  // ── 6. Profile Reviews ────────────────────────────────────────
  await db.insert(schema.profileReviewsTable).values([
    // Salon reviews
    {
      profileId: prof1.id, reviewerName: "Priya Sharma", reviewerPhone: "9000002222",
      reviewerAge: 30, rating: 5,
      comment: "Amazing haircut and color job! Raj bhai is a genius. Will definitely come back.",
    },
    {
      profileId: prof1.id, reviewerName: "Aarav Mehta", reviewerPhone: "9000001111",
      reviewerAge: 33, rating: 4,
      comment: "Good service, clean salon. The fade cut was perfect.",
    },
    {
      profileId: prof1.id, reviewerName: "Sunita Devi", reviewerPhone: "9111222333",
      reviewerAge: 45, rating: 5,
      comment: "Best bridal makeup in Pune! My wedding photos look stunning 👰",
    },
    // Gym reviews
    {
      profileId: prof2.id, reviewerName: "Kabir Singh", reviewerPhone: "9100001111",
      reviewerAge: 27, rating: 5,
      comment: "Excellent gym with great equipment. The trainers are super professional and motivating!",
    },
    {
      profileId: prof2.id, reviewerName: "Anjali Verma", reviewerPhone: "9100002222",
      reviewerAge: 26, rating: 4,
      comment: "Zumba classes are amazing. Lost 6 kgs in 3 months!",
    },
    // Electrician reviews
    {
      profileId: prof3.id, reviewerName: "Suresh Patel", reviewerPhone: "9200001111",
      rating: 5,
      comment: "Very professional work. Completed our flat wiring in 2 days. No mess, clean work.",
    },
    {
      profileId: prof3.id, reviewerName: "Harish Kumar", reviewerPhone: "9200003333",
      reviewerAge: 50, rating: 5,
      comment: "Panel upgrade done quickly and safely. Sharma ji is highly trustworthy.",
    },
  ]);

  console.log("✓ Profile reviews inserted");

  // ── 7. Reminder & Review logs ─────────────────────────────────
  await db.insert(schema.reminderLogsTable).values([
    { businessId: biz1.id, customerId: salonCustomers[0].id, sentAt: new Date("2026-03-09") },
    { businessId: biz1.id, customerId: salonCustomers[1].id, sentAt: new Date("2026-04-20") },
    { businessId: biz2.id, customerId: gymCustomers[0].id, sentAt: new Date("2026-03-28") },
    { businessId: biz3.id, customerId: elecCustomers[0].id, sentAt: new Date("2026-09-01") },
  ]);

  await db.insert(schema.reviewLogsTable).values([
    { businessId: biz1.id, customerId: salonCustomers[0].id, sentAt: new Date("2026-03-11") },
    { businessId: biz1.id, customerId: salonCustomers[3].id, sentAt: new Date("2026-02-16") },
    { businessId: biz2.id, customerId: gymCustomers[0].id, sentAt: new Date("2026-03-02") },
    { businessId: biz3.id, customerId: elecCustomers[2].id, sentAt: new Date("2026-02-21") },
  ]);

  console.log("✓ Reminder & review logs inserted");

  console.log("\n✅ Seed complete!");
  console.log(`   Businesses : 3`);
  console.log(`   Users      : 3`);
  console.log(`   Customers  : ${salonCustomers.length + gymCustomers.length + elecCustomers.length}`);
  console.log(`   Profiles   : 3`);
  console.log(`   Reviews    : 7`);
  console.log(`   Service logs : 11`);

  await pool.end();
}

seed().catch((err) => { console.error("Seed failed:", err); process.exit(1); });
