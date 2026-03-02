import { execSync } from 'node:child_process'

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
}

const prismaCommand = process.platform === 'win32'
  ? '.\\planner-api\\node_modules\\.bin\\prisma.cmd generate --schema=planner-api/prisma/schema.prisma'
  : './planner-api/node_modules/.bin/prisma generate --schema=planner-api/prisma/schema.prisma'

execSync(prismaCommand, {
  stdio: 'inherit',
  env,
})
