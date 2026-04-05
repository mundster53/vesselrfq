import { hashPassword } from '../api/_lib/auth.js'

const hash = await hashPassword('TestFab2024!')
console.log(hash)
