import { HomeScreen } from "../screens/HomeScreen";
import { usePicPac } from "../state/PicPacProvider";
export default function HomeRoute() { return <HomeScreen controller={usePicPac()} />; }
