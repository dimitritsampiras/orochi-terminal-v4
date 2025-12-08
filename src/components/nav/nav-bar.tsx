'use client';

import { usePathname } from 'next/navigation';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import Image from 'next/image';

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="z-40 hidden h-screen min-h-[30rem] min-w-56 md:flex">
      <div className="fixed hidden h-dvh w-56 flex-1 flex-col border-r border-zinc-200 bg-white md:flex">
        <div className="flex items-center justify-center h-16 border-b border-zinc-200">
          
        </div>
        <ul className="flex flex-col gap-1.5 overflow-hidden mt-4">
          {SITE.routes.map(({ path, name, icon }) => (
            <li key={path}>
              <Link
                draggable="false"
                href={path}
                className={cn(
                  'nav-item relative flex items-center gap-2.5 px-6 py-2 font-normal cursor-pointer opacity-30 transition-all duration-200 ease-linear text-sm hover:opacity-100',
                  {
                    'active opacity-100 pl-8 bg-zinc-50': pathname.startsWith(path)
                  }
                )}
              >
                <Icon icon={icon} className="size-4" />
                <span>{name}</span>
              </Link>
            </li>
          ))}
          <hr className="my-2" />
          {SITE.subRoutes.map(({ path, name, icon }) => (
            <li key={path}>
              <Link
                draggable="false"
                href={path}
                className={cn(
                  'nav-item relative flex items-center gap-2.5 px-6 py-2 font-normal cursor-pointer opacity-30 transition-all duration-200 ease-linear text-sm hover:opacity-100',
                  {
                    'active opacity-100 pl-8 bg-zinc-50': pathname === path
                  }
                )}
              >
                <Icon icon={icon} className="size-4" />
                <span>{name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
