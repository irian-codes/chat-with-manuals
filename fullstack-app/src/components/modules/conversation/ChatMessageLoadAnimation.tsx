type Props = {
  isLoading: boolean;
};

export const ChatMessageLoadAnimation = (props: Props) => {
  if (!props.isLoading) return null;

  return (
    <div className="w-24">
      <div className="rounded-md bg-muted p-4">
        <div className="flex items-center justify-evenly gap-2">
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary delay-150"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary delay-300"></div>
        </div>
      </div>
    </div>
  );
};
