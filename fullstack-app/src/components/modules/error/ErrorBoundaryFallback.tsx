import MainLayout from '@/components/reusable/MainLayout';
import {Button} from '@/components/shadcn-ui/button';
import Image from 'next/image';
import {useRouter} from 'next/router';
import {useState} from 'react';

type Props = {
  error: Error;
  resetErrorBoundary: () => void;
};

export const ErrorBoundaryFallback = (props: Props) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleGoHomeButtonClick() {
    setIsLoading(true);

    await router.push('/');
    props.resetErrorBoundary();

    setIsLoading(false);
  }

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center gap-2">
        <Image
          src="/error-mascot.webp"
          alt="Error mascot"
          width={100}
          height={100}
          className="motion-preset-shake motion-delay-100 mb-4"
        />
        <h1 className="text-2xl font-bold">
          Oh! There was an unexpected error...
        </h1>
        <p>Please, try again by navigating from the home page.</p>

        <Button
          variant="default"
          size="lg"
          onClick={handleGoHomeButtonClick}
          disabled={isLoading}
          className="mt-4"
        >
          Go to home page
        </Button>
      </div>
    </MainLayout>
  );
};
