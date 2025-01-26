type Props = {
  isLoading: boolean;
};

export const ChatMessageLoadAnimation = (props: Props) => {
  if (!props.isLoading) return null;

  return (
    <div className="w-24">
      <div className="rounded-md bg-muted p-4">
        <div className="flex items-center justify-evenly gap-2">
          <div className="motion-preset-oscillate-lg h-2 w-2 rounded-full bg-primary"></div>
          <div className="motion-preset-oscillate-lg h-2 w-2 rounded-full bg-primary motion-delay-150"></div>
          <div className="motion-preset-oscillate-lg h-2 w-2 rounded-full bg-primary motion-delay-300"></div>
        </div>
      </div>
    </div>
  );
};
