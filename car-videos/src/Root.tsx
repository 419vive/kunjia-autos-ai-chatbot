import { Composition } from "remotion";
import { CarShowcase } from "./CarShowcase";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CarShowcase"
        component={CarShowcase}
        durationInFrames={600}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
