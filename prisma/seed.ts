// @ts-nocheck
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
  // 1. Ensure Admin exists
  const hashedPassword = await bcrypt.hash('password', 10);
  
  let admin = await prisma.user.findUnique({ where: { email: 'admin@gmail.com' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: 'admin@gmail.com',
        password: hashedPassword,
        role: 'ADMIN',
        name: 'Quản trị viên',
      },
    });
    console.log('✅ Created admin: admin@gmail.com / password');
  }

  // 2. Seed Employees
  console.log('🌱 Checking/Seeding employees...');
  const employees = [];
  for (let i = 0; i < 50; i++) {
    const email = `employee${String(i + 1).padStart(2, '0')}@company.com`;
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const name = `${firstName} ${lastName} ${Math.floor(i / lastNames.length) + 1}`.trim();
    
    const emp = await prisma.user.upsert({
      where: { email },
      update: { password: hashedPassword },
      create: {
        email,
        password: hashedPassword,
        role: 'EMPLOYEE',
        name,
        creatorId: admin.id,
      },
    });
    employees.push(emp);
  }

  // 3. Seed Attendance (50 records)
  console.log('🌱 Seeding 50 attendance records with randomized sessions...');
  let seededCount = 0;
  
  const selectedEmployees = employees.slice(0, 10); // Spread records across 10 employees for better density

  for (let i = 0; i < 50; i++) {
    const employee = selectedEmployees[i % selectedEmployees.length];
    const date = new Date();
    // Historical data for last 15 days
    const dayOffset = Math.floor(i / selectedEmployees.length);
    date.setDate(date.getDate() - dayOffset - 1);
    date.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.upsert({
      where: {
        userId_date: {
          userId: employee.id,
          date,
        },
      },
      update: {},
      create: {
        userId: employee.id,
        date,
        status: 'PRESENT',
        totalHours: 0,
      },
    });

    const sessionCount = await prisma.attendanceSession.count({
      where: { attendanceId: attendance.id },
    });

    if (sessionCount === 0) {
      const numSessions = Math.floor(Math.random() * 2) + 1;
      let totalMinutes = 0;
      const sessions = [];

      // Morning
      const s1In = new Date(date);
      s1In.setHours(8, Math.floor(Math.random() * 15), 0);
      const s1Out = new Date(date);
      const s1Duration = 180 + Math.floor(Math.random() * 90); // 3-4.5h
      s1Out.setTime(s1In.getTime() + s1Duration * 60000);
      
      sessions.push({ attendanceId: attendance.id, checkinTime: s1In, checkoutTime: s1Out });
      totalMinutes += s1Duration;

      if (numSessions > 1) {
        // Afternoon
        const s2In = new Date(date);
        s2In.setHours(13, 30 + Math.floor(Math.random() * 15), 0);
        const s2Out = new Date(date);
        const s2Duration = 180 + Math.floor(Math.random() * 60); // 3-4h
        s2Out.setTime(s2In.getTime() + s2Duration * 60000);
        
        sessions.push({ attendanceId: attendance.id, checkinTime: s2In, checkoutTime: s2Out });
        totalMinutes += s2Duration;
      }

      await prisma.attendanceSession.createMany({ data: sessions });
      
      await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
        },
      });
      seededCount++;
    }
  }

  console.log(`✅ Hoàn thành: Đã xử lý 50 nhân viên và tạo ${seededCount} bản ghi attendance mới.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
