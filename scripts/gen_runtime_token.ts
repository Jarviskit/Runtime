import jwt from "jsonwebtoken";

(async () => {
  const payload = {
    id: "123123",
    fullName: "Nghia Pham"
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
  console.log(token);
})();