'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Login(){const r=useRouter();const [f,setF]=useState({username:'admin',password:'123456'});const [e,setE]=useState('');
const submit=async()=>{const res=await fetch('/api/auth/login',{method:'POST',body:JSON.stringify(f)});if(res.ok) r.push('/dashboard'); else setE('账号或密码错误');};
return <main className='min-h-screen flex items-center justify-center'><div className='w-full max-w-md bg-white p-6 rounded-xl border'><h1 className='text-2xl font-bold mb-4'>欧信售前客服作战台</h1><input className='w-full border p-2 mb-2' value={f.username} onChange={e=>setF({...f,username:e.target.value})}/><input className='w-full border p-2 mb-2' type='password' value={f.password} onChange={e=>setF({...f,password:e.target.value})}/><button onClick={submit} className='w-full bg-blue-600 text-white p-2 rounded'>登录</button><p className='text-red-500 mt-2'>{e}</p></div></main>}
