import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../config/fireBase";
import "../styles/ProfileDropdown.css";

interface Props {
  open: boolean;
}

export default function ProfileDropdown({ open }: Props) {
  const navigate = useNavigate();

  if (!open) return null;

  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div className="profile-dropdown">
      <button onClick={() => navigate("/profile")}>
        <i className="bx bx-user"></i>

        <span>My Profile</span>
      </button>

      <button onClick={() => navigate("/settings")}>
        <i className="bx bx-cog"></i>

        <span>Settings</span>
      </button>

      <button className="logout-btn" onClick={logout}>
        <i className="bx bx-log-out"></i>

        <span>Logout</span>
      </button>
    </div>
  );
}
