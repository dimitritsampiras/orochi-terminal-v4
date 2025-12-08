'use client';

import { usePathname } from 'next/navigation';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';
import { Icon } from '@iconify/react';
import Link from 'next/link';
// import Image from 'next/image';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Button, buttonVariants } from '../ui/button';
import { useState } from 'react';

export default function MobileMenu() {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger
        className={buttonVariants({
          variant: 'outline',
          size: 'icon'
        })}
      >
        <Icon icon="ph:list" className="size-4" />
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <nav className="px-4 w-full">
          <ul className="flex flex-col gap-2 mt-4">
            {SITE.routes.map(({ path, name, icon }) => (
              <li key={path}>
                <Link
                  draggable="false"
                  href={path}
                  className={cn(
                    'relative flex items-center gap-4 py-2 text-xl font-normal cursor-pointer opacity-30 transition-all duration-200 ease-linear',
                    {
                      'opacity-100 bg-zinc-50': pathname === path
                    }
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon icon={icon} className="size-5" />
                  <span>{name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <hr className="my-6" />
          <ul className="flex flex-col gap-2 mt-4">
            {SITE.subRoutes.map(({ path, name, icon }) => (
              <li key={path}>
                <Link
                  draggable="false"
                  href={path}
                  className={cn(
                    'relative flex items-center gap-4 py-2 text-xl font-normal cursor-pointer opacity-30 transition-all duration-200 ease-linear',
                    {
                      'opacity-100 bg-zinc-50': pathname === path
                    }
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon icon={icon} className="size-5" />
                  <span>{name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
