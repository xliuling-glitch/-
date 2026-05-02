import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

export async function login(username:string,password:string){
  const u=await prisma.user.findUnique({where:{username},include:{role:true}});
  if(!u) return null;
  const ok=await bcrypt.compare(password,u.passwordHash);
  if(!ok) return null;
  cookies().set('session',JSON.stringify({id:u.id,role:u.role.code,name:u.name,username:u.username}),{httpOnly:true,path:'/'});
  return u;
}

export function getSession(){const c=cookies().get('session')?.value;return c?JSON.parse(c):null;}
