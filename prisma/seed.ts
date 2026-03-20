import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const firstNames = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
];
const lastNames = [
  'An', 'Bình', 'Chi', 'Dung', 'Giang', 'Hà', 'Hùng', 'Khoa', 'Lan', 'Linh',
  'Long', 'Mai', 'Minh', 'Nam', 'Nga', 'Ngọc', 'Nhân', 'Phúc', 'Quân', 'Sơn',
  'Tâm', 'Thảo', 'Thiện', 'Thu', 'Thủy', 'Tiến', 'Toàn', 'Trang', 'Tuấn', 'Vy',
];

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.error('Không tìm thấy tài khoản admin. Hãy đảm bảo DB đã có admin.');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash('123456', 10);

  const employees = Array.from({ length: 50 }, (_, i) => {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const name = `${firstName} ${lastName} ${Math.floor(i / lastNames.length) + 1}`.trim();
    return {
      email: `employee${String(i + 1).padStart(2, '0')}@company.com`,
      password: hashedPassword,
      role: 'EMPLOYEE' as const,
      name,
      creatorId: admin.id,
    };
  });

  let created = 0;
  let skipped = 0;

  for (const emp of employees) {
    const exists = await prisma.user.findUnique({ where: { email: emp.email } });
    if (exists) {
      skipped++;
      continue;
    }
    await prisma.user.create({ data: emp });
    created++;
  }

  console.log(`✅ Seed xong: ${created} nhân viên mới, ${skipped} đã tồn tại (bỏ qua).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
