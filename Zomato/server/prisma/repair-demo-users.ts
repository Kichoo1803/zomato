import "dotenv/config";
import bcrypt from "bcrypt";
import { Role } from "../src/constants/enums.js";
import { createPrismaClient } from "../src/lib/prisma-client.js";

const prisma = createPrismaClient({
  log: ["warn", "error"],
});

const DEMO_PASSWORD = "Password@123";

type DemoUser = {
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  walletBalance?: number;
};

const avatarUrl = (seed: string) => `https://i.pravatar.cc/300?u=${encodeURIComponent(seed)}`;

const demoUsers: DemoUser[] = [
  { fullName: "Aditya Sen", email: "admin@zomatoluxe.dev", phone: "+919800000001", role: Role.ADMIN },
  {
    fullName: "Ananya Rao",
    email: "ops@zomatoluxe.dev",
    phone: "+919840000401",
    role: Role.REGIONAL_MANAGER,
  },
  {
    fullName: "Aarav Mehta",
    email: "aarav.mehta@zomatoluxe.dev",
    phone: "+919810000101",
    role: Role.RESTAURANT_OWNER,
  },
  {
    fullName: "Rhea Kapoor",
    email: "rhea.kapoor@zomatoluxe.dev",
    phone: "+919810000102",
    role: Role.RESTAURANT_OWNER,
  },
  {
    fullName: "Vihaan Sharma",
    email: "vihaan.sharma@zomatoluxe.dev",
    phone: "+919810000103",
    role: Role.RESTAURANT_OWNER,
  },
  {
    fullName: "Sana Iyer",
    email: "sana.iyer@zomatoluxe.dev",
    phone: "+919810000104",
    role: Role.RESTAURANT_OWNER,
  },
  {
    fullName: "Kabir Malhotra",
    email: "kabir.malhotra@zomatoluxe.dev",
    phone: "+919810000105",
    role: Role.RESTAURANT_OWNER,
  },
  {
    fullName: "Naina Rao",
    email: "naina.rao@zomatoluxe.dev",
    phone: "+919810000106",
    role: Role.RESTAURANT_OWNER,
  },
  {
    fullName: "Ravi Kumar",
    email: "ravi.kumar@zomatoluxe.dev",
    phone: "+919820000201",
    role: Role.DELIVERY_PARTNER,
  },
  {
    fullName: "Imran Sheikh",
    email: "imran.sheikh@zomatoluxe.dev",
    phone: "+919820000202",
    role: Role.DELIVERY_PARTNER,
  },
  {
    fullName: "Deepak Nair",
    email: "deepak.nair@zomatoluxe.dev",
    phone: "+919820000203",
    role: Role.DELIVERY_PARTNER,
  },
  {
    fullName: "Pooja Yadav",
    email: "pooja.yadav@zomatoluxe.dev",
    phone: "+919820000204",
    role: Role.DELIVERY_PARTNER,
  },
  {
    fullName: "Salman Ansari",
    email: "salman.ansari@zomatoluxe.dev",
    phone: "+919820000205",
    role: Role.DELIVERY_PARTNER,
  },
  {
    fullName: "Aditi Verma",
    email: "aditi.verma@zomatoluxe.dev",
    phone: "+919830000301",
    role: Role.CUSTOMER,
    walletBalance: 1250,
  },
  {
    fullName: "Rohit Bansal",
    email: "rohit.bansal@zomatoluxe.dev",
    phone: "+919830000302",
    role: Role.CUSTOMER,
    walletBalance: 480,
  },
  {
    fullName: "Meera Nair",
    email: "meera.nair@zomatoluxe.dev",
    phone: "+919830000303",
    role: Role.CUSTOMER,
    walletBalance: 890,
  },
  {
    fullName: "Ishaan Khanna",
    email: "ishaan.khanna@zomatoluxe.dev",
    phone: "+919830000304",
    role: Role.CUSTOMER,
    walletBalance: 1560,
  },
  {
    fullName: "Priya Menon",
    email: "priya.menon@zomatoluxe.dev",
    phone: "+919830000305",
    role: Role.CUSTOMER,
    walletBalance: 620,
  },
  {
    fullName: "Kunal Deshpande",
    email: "kunal.deshpande@zomatoluxe.dev",
    phone: "+919830000306",
    role: Role.CUSTOMER,
    walletBalance: 320,
  },
  {
    fullName: "Simran Bedi",
    email: "simran.bedi@zomatoluxe.dev",
    phone: "+919830000307",
    role: Role.CUSTOMER,
    walletBalance: 940,
  },
  {
    fullName: "Arjun Sethi",
    email: "arjun.sethi@zomatoluxe.dev",
    phone: "+919830000308",
    role: Role.CUSTOMER,
    walletBalance: 770,
  },
  {
    fullName: "Neha Kulkarni",
    email: "neha.kulkarni@zomatoluxe.dev",
    phone: "+919830000309",
    role: Role.CUSTOMER,
    walletBalance: 1340,
  },
  {
    fullName: "Dev Patel",
    email: "dev.patel@zomatoluxe.dev",
    phone: "+919830000310",
    role: Role.CUSTOMER,
    walletBalance: 510,
  },
];

const existingUserSelect = {
  id: true,
  email: true,
  phone: true,
  profileImage: true,
  walletBalance: true,
} as const;

const findExistingDemoUser = async (user: DemoUser) => {
  const [existingByEmail, existingByPhone] = await Promise.all([
    prisma.user.findUnique({
      where: { email: user.email },
      select: existingUserSelect,
    }),
    prisma.user.findFirst({
      where: { phone: user.phone },
      select: existingUserSelect,
    }),
  ]);

  if (existingByEmail && existingByPhone && existingByEmail.id !== existingByPhone.id) {
    throw new Error(
      `Demo user conflict for ${user.email}. Email and phone resolve to different users (${existingByEmail.id} and ${existingByPhone.id}).`,
    );
  }

  return existingByEmail ?? existingByPhone;
};

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const summary = {
    created: [] as string[],
    updated: [] as string[],
  };

  for (const demoUser of demoUsers) {
    const existingUser = await findExistingDemoUser(demoUser);

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: demoUser.fullName,
          email: demoUser.email,
          phone: demoUser.phone,
          passwordHash,
          profileImage: existingUser.profileImage ?? avatarUrl(demoUser.email),
          role: demoUser.role,
          isActive: true,
          emailVerified: true,
          phoneVerified: true,
          walletBalance: existingUser.walletBalance ?? demoUser.walletBalance ?? 0,
        },
      });

      summary.updated.push(demoUser.email);
      continue;
    }

    await prisma.user.create({
      data: {
        fullName: demoUser.fullName,
        email: demoUser.email,
        phone: demoUser.phone,
        passwordHash,
        profileImage: avatarUrl(demoUser.email),
        role: demoUser.role,
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
        walletBalance: demoUser.walletBalance ?? 0,
      },
    });

    summary.created.push(demoUser.email);
  }

  console.log(
    JSON.stringify(
      {
        demoPassword: DEMO_PASSWORD,
        repairedAccounts: demoUsers.length,
        created: summary.created,
        updated: summary.updated,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Demo user repair failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
