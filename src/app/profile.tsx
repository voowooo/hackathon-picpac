import { ProfileScreen } from "../screens/ProfileScreen";
import { usePicPac } from "../state/PicPacProvider";
export default function ProfileRoute() { return <ProfileScreen controller={usePicPac()} />; }
