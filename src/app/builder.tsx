import { BuilderScreen } from "../screens/BuilderScreen";
import { usePicPac } from "../state/PicPacProvider";
export default function BuilderRoute() { return <BuilderScreen controller={usePicPac()} />; }
