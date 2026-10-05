# TaskFlow

เว็บแอปจัดการงานทีม สร้างด้วย Next.js, TypeScript และ Supabase

## เริ่มใช้งานในเครื่อง

1. ติดตั้ง Node.js 20.9 ขึ้นไป
2. ติดตั้ง dependencies:

   ```bash
   npm ci
   ```

3. คัดลอก `.env.example` เป็น `.env.local` แล้วกำหนดค่าจาก Supabase Project Settings > API:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. สำหรับฐานข้อมูลใหม่ ให้รัน `supabase/schema.sql` ใน Supabase SQL Editor
   สำหรับฐานข้อมูลเดิม ให้ตรวจ migration history และรันเฉพาะ migration ที่ยังไม่ได้ apply ตามลำดับชื่อไฟล์ ห้ามรัน schema ทับฐานข้อมูลเดิม
5. เริ่ม dev server:

   ```bash
   npm run dev
   ```

เปิด [http://localhost:3000](http://localhost:3000)

## ตรวจสอบก่อน Deploy

```bash
npm run lint
npx tsc --noEmit
npm run build
```

จากนั้นทดสอบ production build ในเครื่องได้ด้วย:

```bash
npm run start
```

## Deploy บน Vercel

1. Import Git repository ใน Vercel และตั้ง **Root Directory** เป็น `taskflow` หาก repository ครอบโฟลเดอร์โปรเจกต์ไว้
2. ตั้ง Environment Variables สำหรับ Production และ Preview:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. ตั้ง Supabase Authentication URL Configuration ให้ Site URL เป็นโดเมน production และเพิ่มโดเมน production/preview ที่ใช้งานจริงใน Redirect URLs
4. ยืนยันว่า migration ที่จำเป็นทั้งหมดถูก apply ใน Supabase project เป้าหมายก่อนเปิดใช้งาน
5. Deploy แล้วทดสอบ login, สมัคร/อนุมัติสมาชิก, Dashboard, Board, notification และ RLS ด้วยบัญชีแต่ละ Role

ใช้เฉพาะ Supabase publishable/anon key ใน frontend ตามที่ RLS กำหนด ห้ามนำ `service_role` key ไปใส่ใน `NEXT_PUBLIC_*` หรือ commit ลง repository
