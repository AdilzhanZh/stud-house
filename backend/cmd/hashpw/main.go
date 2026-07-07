// hashpw is a one-off CLI to bcrypt-hash a password, for seeding the first
// admin user directly via SQL (self-registration only creates students —
// see README.md "Бірінші admin пайдаланушысын жасау").
package main

import (
	"flag"
	"fmt"
	"log"

	"student-house/pkg/hasher"
)

func main() {
	password := flag.String("password", "", "plaintext password to hash")
	flag.Parse()
	if *password == "" {
		log.Fatal("-password is required")
	}
	hash, err := hasher.HashPassword(*password)
	if err != nil {
		log.Fatalf("failed to hash password: %v", err)
	}
	fmt.Println(hash)
}
