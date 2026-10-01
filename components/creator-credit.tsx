/* oxlint-disable next/no-img-element -- Keep this small local PNG direct; Next is not installed in this app. */
export function CreatorCredit() {
  return (
    <>
      <a
        className="creator-credit"
        href="https://barrilito.dev/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="By BarrilitoDev"
      >
        <img
          className="creator-credit__icon"
          src="/media/barrilitodev-icon-dark.png"
          alt="BarrilitoDev logo"
          width="24"
          height="24"
        />
        <span>By BarrilitoDev</span>
      </a>
      <style>{`
        .creator-credit {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          color: rgba(255, 255, 255, 0.62);
          font-size: 0.68rem;
          letter-spacing: 0.04em;
          text-decoration: none;
          transition: color 180ms ease, text-shadow 180ms ease;
        }

        .creator-credit::after {
          position: absolute;
          right: 0;
          bottom: -0.22rem;
          left: 0;
          height: 1px;
          background: currentColor;
          content: "";
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 180ms ease;
        }

        .creator-credit__icon {
          border-radius: 50%;
          transition: transform 180ms ease;
        }

        .creator-credit:hover,
        .creator-credit:focus-visible {
          color: #fff;
          text-shadow: 0 0 0.8rem rgba(255, 255, 255, 0.3);
        }

        .creator-credit:hover::after,
        .creator-credit:focus-visible::after {
          transform: scaleX(1);
        }

        .creator-credit:hover .creator-credit__icon,
        .creator-credit:focus-visible .creator-credit__icon {
          transform: rotate(-8deg) scale(1.08);
        }

        .creator-credit:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 5px;
        }

        @media (prefers-reduced-motion: reduce) {
          .creator-credit,
          .creator-credit::after,
          .creator-credit__icon {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}
