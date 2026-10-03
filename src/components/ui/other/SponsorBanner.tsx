const sponsorUrl = "https://duelbet.com/";
const sponsorImage = "/duelbet_300x150.png";

const SponsorBanner = () => {
  return (
    <section className="relative z-3 flex justify-center px-2" aria-label="Sponsored content">
      <a
        href={sponsorUrl}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="block overflow-hidden rounded-lg border border-white/10 transition-opacity hover:opacity-90"
        aria-label="Visit sponsor offer"
      >
        <img
          src={sponsorImage}
          alt="DuelBet sponsor"
          width={300}
          height={150}
          className="h-auto w-full max-w-[300px] object-cover"
          loading="lazy"
        />
      </a>
    </section>
  );
};

export default SponsorBanner;
