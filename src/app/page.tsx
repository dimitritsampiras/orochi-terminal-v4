import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Home() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <div className="max-w-md space-y-4">
        <Input placeholder="Enter your name" />
        <Button>Click me</Button>
      </div>
    </div>
  );
}
