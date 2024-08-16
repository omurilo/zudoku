import { forwardRef, type PropsWithChildren } from "react";
import { cn } from "../../util/cn.js";

export const SidebarWrapper = forwardRef<
  HTMLDivElement,
  PropsWithChildren<{ pushMainContent?: boolean; className?: string }>
>(function SideNavigation({ children, className, pushMainContent }, ref) {
  return (
    <nav
      // this data attribute is used in `Layout.tsx` to determine if side navigation
      // is present for the current page so the main content is pushed to the right
      // it's also important to set `peer` class here.
      // maybe this could be simplified by adjusting the layout
      data-navigation={String(pushMainContent)}
      className={cn(
        "peer hidden lg:flex flex-col fixed text-sm overflow-y-auto shrink-0 p-[--padding-nav-item] -mx-[--padding-nav-item] pb-20 pt-[--padding-content-top] w-[--side-nav-width] h-[calc(100%-var(--header-height))] scroll-pt-2 gap-2",
        className,
      )}
      ref={ref}
    >
      {children}
    </nav>
  );
});