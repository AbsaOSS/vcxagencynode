cd "$(dirname $0)" || exit

TARGET_PROJECTS=("vcxagency-node" "vcxagency-client" "easy-indysdk")

for project in "${TARGET_PROJECTS[@]}";
do
  echo "Auditing $project"
  cd "../$project" && yarn audit
done
