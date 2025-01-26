import Link from 'next/link';
import React from 'react';

type Props = {
  disabled?: boolean;
  linkProps: React.ComponentPropsWithoutRef<typeof Link>;
  divProps?: React.ComponentPropsWithoutRef<'div'>;
  children: React.ReactNode;
};

export const ToggleableLink = (props: Props) => {
  if (props.disabled) {
    return <div {...props.divProps}>{props.children}</div>;
  }

  return (
    <Link className="underline-offset-4 hover:underline" {...props.linkProps}>
      {props.children}
    </Link>
  );
};
