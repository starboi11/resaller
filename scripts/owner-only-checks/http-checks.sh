#!/usr/bin/env bash
A=http://127.0.0.1:4000/api/v1; O="Origin: http://localhost:3000"; J="content-type: application/json"
login() { curl -s -c /tmp/$1.jar -H "$O" -H "$J" -d "{\"username\":\"$1\",\"password\":\"Parol123\"}" $A/auth/login >/dev/null; }
code() { curl -s -o /dev/null -w "%{http_code}" -b /tmp/$1.jar -H "$O" "$A$2"; }
for u in xaridor eski_sotuvchi eski_azo egasi; do login $u; done
printf "%-14s %-12s %-14s %-22s %-22s %-18s %s\n" ROLE isOwner /seller/stores center:owner-store center:old-store owner-settings new-listing-old-store
for u in xaridor eski_sotuvchi eski_azo egasi; do
  owner=$(curl -s -b /tmp/$u.jar -H "$O" $A/seller/owner-status | python3 -c "import sys,json;print(json.load(sys.stdin)['isOwner'])")
  post=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/$u.jar -H "$O" -H "$J" -d '{"categorySlug":"elektronika","nameUz":"Test","descriptionUz":"Test tavsif matni","priceMinor":"1000","stock":1}' $A/stores/cstoreother0000000000002/listings)
  settings=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -b /tmp/$u.jar -H "$O" -H "$J" -d '{}' $A/stores/cstoreowner0000000000001/settings)
  printf "%-14s %-12s %-14s %-22s %-22s %-18s %s\n" $u $owner $(code $u /seller/stores) $(code $u /seller-center/stores/cstoreowner0000000000001/dashboard) $(code $u /seller-center/stores/cstoreother0000000000002/dashboard) $settings $post
done
echo "--- buyer catalogue:"; curl -s "$A/marketplace/listings" | python3 -c "import sys,json;[print('  ',i['nameUz']) for i in json.load(sys.stdin)['items']]"
echo "--- old store product by direct link: $(curl -s -o /dev/null -w '%{http_code}' $A/marketplace/listings/clistother000000000000001)  old store page: $(curl -s -o /dev/null -w '%{http_code}' $A/stores/eski_dokon)  owner store page: $(curl -s -o /dev/null -w '%{http_code}' $A/stores/resaller)"
