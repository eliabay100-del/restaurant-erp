import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Warka Dine database...\n');

  // ============ STAFF ============
  console.log('👥 Creating staff members...');
  const staffData = [
    { name: 'Admin', nameAm: 'አድሚን', pin: '1234', role: 'ADMIN' },
    { name: 'Abebe (Manager)', nameAm: 'አበበ (ሥራ አስኪያጅ)', pin: '5678', role: 'MANAGER' },
    { name: 'Tigist (Cashier)', nameAm: 'ትግስት (ገንዘብ ተቀባይ)', pin: '1111', role: 'CASHIER' },
    { name: 'Dawit (Cashier)', nameAm: 'ዳዊት (ገንዘብ ተቀባይ)', pin: '3333', role: 'CASHIER' },
    { name: 'Kebede (Kitchen)', nameAm: 'ከበደ (ወጥ ቤት)', pin: '2222', role: 'KITCHEN' },
    { name: 'Meron (Kitchen)', nameAm: 'ሜሮን (ወጥ ቤት)', pin: '4444', role: 'KITCHEN' },
  ];

  for (const staff of staffData) {
    const pinHash = await bcrypt.hash(staff.pin, 10);
    await prisma.staff.create({
      data: {
        name: staff.name,
        nameAm: staff.nameAm,
        pinHash,
        role: staff.role,
      },
    });
    console.log(`  ✓ ${staff.name} (PIN: ${staff.pin}, Role: ${staff.role})`);
  }

  // ============ CATEGORIES ============
  console.log('\n📂 Creating menu categories...');
  const categories = [
    { nameEn: 'Appetizers', nameAm: 'ቅንጬ', color: '#f59e0b', icon: '🥗', sortOrder: 1 },
    { nameEn: 'Main Dishes', nameAm: 'ዋና ምግቦች', color: '#ef4444', icon: '🍖', sortOrder: 2 },
    { nameEn: 'Fasting Food', nameAm: 'የጾም ምግብ', color: '#22c55e', icon: '🥬', sortOrder: 3 },
    { nameEn: 'Grills & Tibs', nameAm: 'ጥብስ', color: '#f97316', icon: '🔥', sortOrder: 4 },
    { nameEn: 'Soups', nameAm: 'ሾርባ', color: '#8b5cf6', icon: '🍲', sortOrder: 5 },
    { nameEn: 'Drinks', nameAm: 'መጠጦች', color: '#3b82f6', icon: '🥤', sortOrder: 6 },
    { nameEn: 'Hot Drinks', nameAm: 'ሞቅ መጠጦች', color: '#92400e', icon: '☕', sortOrder: 7 },
    { nameEn: 'Desserts', nameAm: 'ጣፋጮች', color: '#ec4899', icon: '🍰', sortOrder: 8 },
    { nameEn: 'Breakfast', nameAm: 'ቁርስ', color: '#14b8a6', icon: '🍳', sortOrder: 9 },
    { nameEn: 'Sides', nameAm: 'ተጨማሪ', color: '#64748b', icon: '🥖', sortOrder: 10 },
  ];

  const createdCategories: Record<string, number> = {};
  for (const cat of categories) {
    const created = await prisma.category.create({ data: cat });
    createdCategories[cat.nameEn] = created.id;
    console.log(`  ✓ ${cat.icon} ${cat.nameEn} / ${cat.nameAm}`);
  }

  // ============ MENU ITEMS ============
  console.log('\n🍽️ Creating menu items...');
  const menuItems = [
    // Appetizers
    { nameEn: 'Sambusa (Meat)', nameAm: 'ሳምቡሳ (ሥጋ)', price: 45, categoryId: createdCategories['Appetizers'], sortOrder: 1 },
    { nameEn: 'Sambusa (Lentil)', nameAm: 'ሳምቡሳ (ምስር)', price: 35, categoryId: createdCategories['Appetizers'], sortOrder: 2 },
    { nameEn: 'Spring Roll', nameAm: 'ስፕሪንግ ሮል', price: 50, categoryId: createdCategories['Appetizers'], sortOrder: 3 },
    { nameEn: 'Kategna', nameAm: 'ቃጠኛ', price: 80, categoryId: createdCategories['Appetizers'], sortOrder: 4 },
    { nameEn: 'Salad', nameAm: 'ሰላጣ', price: 55, categoryId: createdCategories['Appetizers'], sortOrder: 5 },

    // Main Dishes
    { nameEn: 'Doro Wot', nameAm: 'ዶሮ ወጥ', descEn: 'Chicken stew with egg', descAm: 'ከእንቁላል ጋር የዶሮ ወጥ', price: 280, categoryId: createdCategories['Main Dishes'], sortOrder: 1 },
    { nameEn: 'Siga Wot', nameAm: 'ስጋ ወጥ', descEn: 'Beef stew', descAm: 'የሥጋ ወጥ', price: 220, categoryId: createdCategories['Main Dishes'], sortOrder: 2 },
    { nameEn: 'Kitfo', nameAm: 'ክትፎ', descEn: 'Ethiopian steak tartare', descAm: 'ክትፎ ከቅቤ እና ሚጥሚጣ ጋር', price: 300, categoryId: createdCategories['Main Dishes'], sortOrder: 3 },
    { nameEn: 'Zilzil Tibs', nameAm: 'ዝልዝል ጥብስ', descEn: 'Strips of fried beef', descAm: 'የተቆራረጠ ስጋ ጥብስ', price: 250, categoryId: createdCategories['Main Dishes'], sortOrder: 4 },
    { nameEn: 'Dulet', nameAm: 'ዱለት', descEn: 'Mixed organ meat', descAm: 'ጉበት ከክላሊት ጋር', price: 200, categoryId: createdCategories['Main Dishes'], sortOrder: 5 },
    { nameEn: 'Special Beyaynetu', nameAm: 'ልዩ በያይነቱ', descEn: 'Mixed platter of dishes', descAm: 'የተለያዩ ምግቦች ስብስብ', price: 350, categoryId: createdCategories['Main Dishes'], sortOrder: 6 },

    // Fasting Food
    { nameEn: 'Shiro', nameAm: 'ሽሮ', descEn: 'Chickpea stew', descAm: 'የሽሮ ወጥ', price: 120, categoryId: createdCategories['Fasting Food'], sortOrder: 1 },
    { nameEn: 'Misir Wot', nameAm: 'ምስር ወጥ', descEn: 'Red lentil stew', descAm: 'የምስር ወጥ', price: 110, categoryId: createdCategories['Fasting Food'], sortOrder: 2 },
    { nameEn: 'Gomen', nameAm: 'ጎመን', descEn: 'Collard greens', descAm: 'ጎመን ብስል', price: 90, categoryId: createdCategories['Fasting Food'], sortOrder: 3 },
    { nameEn: 'Beyaynetu (Fasting)', nameAm: 'በያይነቱ (ጾም)', descEn: 'Vegan platter', descAm: 'የጾም ምግቦች ስብስብ', price: 200, categoryId: createdCategories['Fasting Food'], sortOrder: 4 },
    { nameEn: 'Atkilt Wot', nameAm: 'አትክልት ወጥ', descEn: 'Cabbage & carrot stew', descAm: 'ጎመን እና ካሮት ወጥ', price: 100, categoryId: createdCategories['Fasting Food'], sortOrder: 5 },
    { nameEn: 'Tikil Gomen', nameAm: 'ትክል ጎመን', price: 95, categoryId: createdCategories['Fasting Food'], sortOrder: 6 },

    // Grills & Tibs
    { nameEn: 'Derek Tibs', nameAm: 'ደረቅ ጥብስ', descEn: 'Dry fried beef', descAm: 'ደረቅ ጥብስ', price: 280, categoryId: createdCategories['Grills & Tibs'], sortOrder: 1 },
    { nameEn: 'Awaze Tibs', nameAm: 'አዋዜ ጥብስ', descEn: 'Spicy fried beef', descAm: 'ቅመም ያበዛ ጥብስ', price: 260, categoryId: createdCategories['Grills & Tibs'], sortOrder: 2 },
    { nameEn: 'Lamb Tibs', nameAm: 'የበግ ጥብስ', price: 320, categoryId: createdCategories['Grills & Tibs'], sortOrder: 3 },
    { nameEn: 'Fish Tibs', nameAm: 'የዓሳ ጥብስ', price: 240, categoryId: createdCategories['Grills & Tibs'], sortOrder: 4 },

    // Soups
    { nameEn: 'Shorba (Meat)', nameAm: 'ሾርባ (ሥጋ)', price: 120, categoryId: createdCategories['Soups'], sortOrder: 1 },
    { nameEn: 'Shorba (Veggie)', nameAm: 'ሾርባ (አትክልት)', price: 85, categoryId: createdCategories['Soups'], sortOrder: 2 },
    { nameEn: 'Tomato Soup', nameAm: 'ቲማቲም ሾርባ', price: 75, categoryId: createdCategories['Soups'], sortOrder: 3 },

    // Drinks
    { nameEn: 'Coca Cola', nameAm: 'ኮካ ኮላ', price: 35, categoryId: createdCategories['Drinks'], sortOrder: 1 },
    { nameEn: 'Sprite', nameAm: 'ስፕራይት', price: 35, categoryId: createdCategories['Drinks'], sortOrder: 2 },
    { nameEn: 'Fanta Orange', nameAm: 'ፋንታ', price: 35, categoryId: createdCategories['Drinks'], sortOrder: 3 },
    { nameEn: 'Ambo Water', nameAm: 'አምቦ ውሃ', price: 30, categoryId: createdCategories['Drinks'], sortOrder: 4 },
    { nameEn: 'Mineral Water', nameAm: 'ንጹህ ውሃ', price: 20, categoryId: createdCategories['Drinks'], sortOrder: 5 },
    { nameEn: 'Fresh Mango Juice', nameAm: 'ትኩስ ማንጎ ጭማቂ', price: 70, categoryId: createdCategories['Drinks'], sortOrder: 6 },
    { nameEn: 'Fresh Avocado Juice', nameAm: 'ትኩስ አቮካዶ ጭማቂ', price: 75, categoryId: createdCategories['Drinks'], sortOrder: 7 },
    { nameEn: 'Spris (Mixed Juice)', nameAm: 'ስፕሪስ', price: 85, categoryId: createdCategories['Drinks'], sortOrder: 8 },
    { nameEn: 'St. George Beer', nameAm: 'ቅዱስ ጊዮርጊስ ቢራ', price: 65, categoryId: createdCategories['Drinks'], sortOrder: 9 },
    { nameEn: 'Habesha Beer', nameAm: 'ሐበሻ ቢራ', price: 70, categoryId: createdCategories['Drinks'], sortOrder: 10 },

    // Hot Drinks
    { nameEn: 'Buna (Coffee)', nameAm: 'ቡና', descEn: 'Traditional Ethiopian coffee', descAm: 'ባህላዊ ቡና', price: 30, categoryId: createdCategories['Hot Drinks'], sortOrder: 1 },
    { nameEn: 'Macchiato', nameAm: 'ማኪያቶ', price: 45, categoryId: createdCategories['Hot Drinks'], sortOrder: 2 },
    { nameEn: 'Cappuccino', nameAm: 'ካፑቺኖ', price: 55, categoryId: createdCategories['Hot Drinks'], sortOrder: 3 },
    { nameEn: 'Tea', nameAm: 'ሻይ', price: 25, categoryId: createdCategories['Hot Drinks'], sortOrder: 4 },
    { nameEn: 'Tea with Milk', nameAm: 'ሻይ በወተት', price: 35, categoryId: createdCategories['Hot Drinks'], sortOrder: 5 },
    { nameEn: 'Hot Chocolate', nameAm: 'ሞቅ ሾኮላት', price: 60, categoryId: createdCategories['Hot Drinks'], sortOrder: 6 },

    // Desserts
    { nameEn: 'Cake Slice', nameAm: 'ኬክ', price: 80, categoryId: createdCategories['Desserts'], sortOrder: 1 },
    { nameEn: 'Baklava', nameAm: 'ባቅላዋ', price: 60, categoryId: createdCategories['Desserts'], sortOrder: 2 },
    { nameEn: 'Ice Cream', nameAm: 'አይስ ክሬም', price: 70, categoryId: createdCategories['Desserts'], sortOrder: 3 },
    { nameEn: 'Fruit Salad', nameAm: 'የፍራፍሬ ሰላጣ', price: 65, categoryId: createdCategories['Desserts'], sortOrder: 4 },

    // Breakfast
    { nameEn: 'Firfir', nameAm: 'ፍርፍር', descEn: 'Shredded injera with sauce', descAm: 'ፍርፍር', price: 90, categoryId: createdCategories['Breakfast'], sortOrder: 1 },
    { nameEn: 'Chechebsa', nameAm: 'ጨጨብሳ', price: 85, categoryId: createdCategories['Breakfast'], sortOrder: 2 },
    { nameEn: 'Kinche', nameAm: 'ቅንጬ', descEn: 'Cracked wheat porridge', descAm: 'ቅንጬ', price: 70, categoryId: createdCategories['Breakfast'], sortOrder: 3 },
    { nameEn: 'Eggs (Scrambled)', nameAm: 'እንቁላል ፍርፍር', price: 65, categoryId: createdCategories['Breakfast'], sortOrder: 4 },
    { nameEn: 'Foul', nameAm: 'ፉል', descEn: 'Mashed fava beans', descAm: 'ፉል', price: 75, categoryId: createdCategories['Breakfast'], sortOrder: 5 },

    // Sides
    { nameEn: 'Extra Injera', nameAm: 'ተጨማሪ እንጀራ', price: 15, categoryId: createdCategories['Sides'], sortOrder: 1 },
    { nameEn: 'Bread', nameAm: 'ዳቦ', price: 20, categoryId: createdCategories['Sides'], sortOrder: 2 },
    { nameEn: 'Fit-Fit', nameAm: 'ፍትፍት', price: 40, categoryId: createdCategories['Sides'], sortOrder: 3 },
    { nameEn: 'Ayib (Cottage Cheese)', nameAm: 'አይብ', price: 45, categoryId: createdCategories['Sides'], sortOrder: 4 },
    { nameEn: 'Kocho', nameAm: 'ቆጮ', price: 30, categoryId: createdCategories['Sides'], sortOrder: 5 },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.create({ data: item });
  }
  console.log(`  ✓ Created ${menuItems.length} menu items across ${categories.length} categories`);

  // ============ SUMMARY ============
  console.log('\n✅ Seed complete!');
  console.log('='.repeat(50));
  console.log(`  Staff:      ${staffData.length} members`);
  console.log(`  Categories: ${categories.length}`);
  console.log(`  Menu Items: ${menuItems.length}`);
  console.log('='.repeat(50));
  console.log('\n🔑 Staff PINs:');
  staffData.forEach(s => console.log(`  ${s.role.padEnd(10)} ${s.name.padEnd(25)} PIN: ${s.pin}`));
  console.log('\n🚀 Start the app with: npm run dev\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
