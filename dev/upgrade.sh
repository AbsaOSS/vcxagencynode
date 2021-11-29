cd "$(dirname $0)" || exit

TARGET_PROJECTS=("easy-indysdk" "vcxagency-client" "vcxagency-node" "vcxagency-artillery")

for project in "${TARGET_PROJECTS[@]}";
do
  echo "Audit fixing $project"
  cd "../$project" && yarn upgrade
done
