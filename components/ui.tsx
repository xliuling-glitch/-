import { cn } from '@/lib/utils';
export const Card=({className,children}:{className?:string,children:React.ReactNode})=><div className={cn('bg-white rounded-xl border p-4 shadow-sm',className)}>{children}</div>;
export const Badge=({color,text}:{color:string,text:string})=><span className={`px-2 py-1 rounded text-xs ${color}`}>{text}</span>;
